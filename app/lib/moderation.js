import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { DISPLAY_MAX_EDGE } from "./images";

/**
 * Contrôle qualité et modération des envois, côté serveur uniquement.
 *
 * Partagé par deux routes :
 *   · /api/moderate-upload : vérification rapide AVANT l'envoi des fichiers
 *     (le contributeur est prévenu tout de suite, sans avoir téléversé un
 *     original de 20 Mo pour rien). En cas de succès, la route remet un
 *     ticket signé qui atteste quelle image exacte a été contrôlée.
 *   · /api/publish-media : publication. Relit la version web déposée sur R2
 *     et n'accepte le ticket que si ces octets sont exactement ceux qui ont
 *     été contrôlés ; sinon, refait tous les contrôles sur le fichier stocké.
 *
 * Contrôles, du moins cher au plus cher : résolution, netteté, doublon,
 * modération IA (nsfw, filigrane, capture d'écran), cette dernière sautée
 * pour les contributeurs de confiance.
 */

// Seuils heuristiques, à ajuster une fois qu'on a du recul sur les envois
// réels (faux positifs/négatifs constatés en production).
export const MIN_MEGAPIXELS = 5; // aligné sur le minimum affiché par Unsplash
export const MIN_SHARPNESS_VARIANCE = 45;
// Volontairement strict (sur 64 bits) : le dHash capture surtout la
// structure de luminance de l'image, pas son contenu fin. Un seuil trop
// large peut confondre deux photos différentes mais visuellement proches.
export const DUPLICATE_HAMMING_THRESHOLD = 4;
export const TRUSTED_PUBLISHED_COUNT = 15;

// Écart toléré entre une version web et ses autres dérivés (vignette, même
// filigranée, et original). Mesuré sur le catalogue le 2026-10-17 : 8 au
// plus entre dérivés d'une même photo, 18 au moins entre deux photos
// différentes.
export const SAME_IMAGE_HAMMING_THRESHOLD = 12;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * dHash 64 bits : 9×8 en niveaux de gris, un bit par comparaison de deux
 * pixels adjacents sur chaque ligne. Insensible aux petites recompressions,
 * donc plus robuste qu'un hash de fichier pour repérer un doublon.
 * `orient` applique la rotation EXIF (originaux d'appareil photo) ; les
 * dérivés produits par le site sont déjà redressés.
 */
export async function computeDHash(buffer, { orient = false } = {}) {
    let pipeline = sharp(buffer, { failOn: "none" });
    if (orient) pipeline = pipeline.rotate();
    const { data } = await pipeline
        .resize(9, 8, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    let hash = 0n;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            hash <<= 1n;
            if (data[row * 9 + col] < data[row * 9 + col + 1]) hash |= 1n;
        }
    }
    return hash.toString(16).padStart(16, "0");
}

/** Nombre de bits différents entre deux empreintes hexadécimales. */
export function hammingDistance(a, b) {
    let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
    let count = 0;
    while (diff) {
        count += Number(diff & 1n);
        diff >>= 1n;
    }
    return count;
}

async function measureSharpness(buffer) {
    const { channels } = await sharp(buffer)
        .greyscale()
        .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
        .stats();
    return channels[0].stdev ** 2;
}

async function checkContentWithAI(buffer, mimeType) {
    const prompt = `
        Tu es un modérateur pour une banque d'images communautaire (comme Unsplash).
        Analyse cette image et détermine si elle enfreint l'une de ces règles :
        - contenu à caractère sexuel, violent ou choquant (nsfw)
        - filigrane, logo de marque ou texte incrusté visible en surimpression (watermark)
        - capture d'écran plutôt qu'une photo ou illustration originale (screenshot)

        Réponds UNIQUEMENT avec un objet JSON valide suivant ce format exact :
        { "nsfw": false, "watermark": false, "screenshot": false, "reason": "" }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
            prompt,
            { inlineData: { data: buffer.toString("base64"), mimeType } },
        ],
        config: { responseMimeType: "application/json" },
    });

    let text = response.text || "{}";
    if (text.startsWith("```")) {
        text = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(text);
}

const fail = (status, error) => ({ ok: false, status, error });

/**
 * Tous les contrôles sur une version web (bord long plafonné à
 * DISPLAY_MAX_EDGE). `supabase` agit au nom du contributeur (RLS).
 * Renvoie `{ ok: true, phash, trusted }` ou `{ ok: false, status, error }`.
 */
export async function runModerationChecks({ supabase, userId, buffer, mimeType, originalWidth, originalHeight, type }) {
    if (!originalWidth || !originalHeight) {
        return fail(400, "Dimensions d'origine manquantes.");
    }

    let metadata;
    try {
        metadata = await sharp(buffer).metadata();
    } catch {
        return fail(400, "Fichier image illisible ou corrompu.");
    }

    // La version web est un redimensionnement direct de l'original (même
    // ratio, bord long plafonné à DISPLAY_MAX_EDGE) : pour un original
    // authentique, son bord long réel correspond exactement à cette
    // formule. Un écart trahit des dimensions d'origine falsifiées.
    const expectedLongEdge = Math.min(Math.max(originalWidth, originalHeight), DISPLAY_MAX_EDGE);
    const actualLongEdge = Math.max(metadata.width || 0, metadata.height || 0);
    if (Math.abs(actualLongEdge - expectedLongEdge) > 4) {
        return fail(400, "Les dimensions annoncées ne correspondent pas à l'image envoyée.");
    }

    // Résolution et netteté visent la qualité d'une photo : la trame
    // extraite d'une vidéo grand public (1080p, environ 2 Mpx) tomberait
    // sous ces seuils sans que cela dise quoi que ce soit de sa qualité.
    const isVideo = type === "video";

    const megapixels = (originalWidth * originalHeight) / 1_000_000;
    if (!isVideo && megapixels < MIN_MEGAPIXELS) {
        return fail(
            422,
            `Image trop petite (${originalWidth}×${originalHeight}px, ${megapixels.toFixed(1)} Mpx) : ${MIN_MEGAPIXELS} Mpx minimum.`
        );
    }

    if (!isVideo) {
        const sharpness = await measureSharpness(buffer);
        // Journalisé à chaque fois : de quoi ajuster MIN_SHARPNESS_VARIANCE
        // sur des données réelles.
        console.log(`[moderation] sharpness=${sharpness.toFixed(1)} threshold=${MIN_SHARPNESS_VARIANCE} result=${sharpness < MIN_SHARPNESS_VARIANCE ? "FAIL" : "PASS"} user=${userId}`);
        if (sharpness < MIN_SHARPNESS_VARIANCE) {
            return fail(422, "Cette image semble floue ou mal mise au point. Essayez une prise plus nette.");
        }
    }

    const phash = await computeDHash(buffer);

    // Comparaison faite dans Postgres (migration 0018). En cas d'échec on
    // laisse passer : le dédoublonnage est un confort de curation, pas un
    // contrôle de sécurité.
    const { data: isDuplicate, error: duplicateError } = await supabase.rpc("phash_has_duplicate", {
        p_phash: phash,
        p_threshold: DUPLICATE_HAMMING_THRESHOLD,
    });
    if (duplicateError) {
        console.error("Détection de doublon impossible :", duplicateError);
    } else if (isDuplicate) {
        return fail(422, "Cette image (ou une image très similaire) est déjà présente sur la plateforme.");
    }

    // Confiance progressive : un historique publié solide dispense de
    // l'appel de modération IA ; les contrôles techniques restent dus.
    const { count: publishedCount, error: countError } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "published");
    if (countError) throw countError;

    const trusted = (publishedCount || 0) >= TRUSTED_PUBLISHED_COUNT;

    if (!trusted) {
        if (!process.env.GEMINI_API_KEY) {
            return fail(500, "La modération automatique n'est pas configurée côté serveur.");
        }

        let verdict;
        try {
            verdict = await checkContentWithAI(buffer, mimeType || "image/jpeg");
        } catch (error) {
            console.error("Modération IA impossible :", error);
            return fail(502, "La vérification automatique du contenu a échoué. Réessayez.");
        }

        if (verdict.nsfw) {
            return fail(422, "Ce contenu ne respecte pas nos règles de publication.");
        }
        if (verdict.watermark) {
            return fail(422, "Cette image semble comporter un filigrane, un logo ou du texte incrusté. Envoyez une version sans surimpression.");
        }
        if (verdict.screenshot) {
            return fail(422, "Les captures d'écran ne sont pas acceptées. Envoyez une photo ou une illustration originale.");
        }
    }

    return { ok: true, phash, trusted };
}

// ---------------------------------------------------------------------------
// Ticket de modération
// ---------------------------------------------------------------------------

const TICKET_TTL_SECONDS = 60 * 60 * 2;

function ticketSecret() {
    return process.env.MODERATION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

/** Empreinte exacte d'un fichier (et non perceptuelle comme le dHash). */
export function sha256(buffer) {
    return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Atteste qu'une image précise (ses octets exacts) a passé les contrôles
 * pour ce contributeur. Valable deux heures, le temps d'envoyer un lot
 * complet sur une connexion lente. `null` si aucun secret n'est configuré :
 * la publication refait alors les contrôles elle-même.
 */
export function signModerationTicket({ userId, digest, phash, trusted }) {
    const secret = ticketSecret();
    if (!secret) return null;
    const payload = Buffer.from(JSON.stringify({
        u: userId,
        d: digest,
        p: phash,
        t: trusted ? 1 : 0,
        e: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
    })).toString("base64url");
    const signature = createHmac("sha256", secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
}

/** Renvoie `{ phash, trusted }` si le ticket est authentique, valide et porte sur ces octets. */
export function verifyModerationTicket(ticket, { userId, digest }) {
    const secret = ticketSecret();
    if (!secret || typeof ticket !== "string") return null;

    const [payload, signature] = ticket.split(".");
    if (!payload || !signature) return null;

    const expected = createHmac("sha256", secret).update(payload).digest();
    let given;
    try {
        given = Buffer.from(signature, "base64url");
    } catch {
        return null;
    }
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    let data;
    try {
        data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
    if (data.u !== userId || data.d !== digest) return null;
    if (!Number.isFinite(data.e) || data.e < Math.floor(Date.now() / 1000)) return null;
    if (typeof data.p !== "string" || !/^[0-9a-f]{16}$/.test(data.p)) return null;

    return { phash: data.p, trusted: data.t === 1 };
}
