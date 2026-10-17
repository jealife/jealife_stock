import sharp from "sharp";
import { r2PublicUrl } from "./r2";
import { DISPLAY_MAX_EDGE, THUMBNAIL_MAX_EDGE } from "./images";
import { SAME_IMAGE_HAMMING_THRESHOLD, computeDHash, hammingDistance } from "./moderation";

/**
 * Règles communes aux routes qui manipulent les fichiers d'un média
 * (publication, remplacement de vignette, signature d'envoi, nettoyage).
 * Serveur uniquement.
 */

// `<uid>/<dossier>/<fichier>` : un seul niveau de dossier, des caractères
// sûrs, jamais de `..`.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** Découpe et valide un chemin d'objet appartenant à `userId`. */
export function parseOwnedPath(path, userId) {
    if (typeof path !== "string" || path.length > 300) return null;
    const parts = path.split("/");
    if (parts.length !== 3 || parts[0] !== userId) return null;
    if (!SAFE_SEGMENT.test(parts[1]) || !SAFE_SEGMENT.test(parts[2])) return null;
    if (parts[1].includes("..") || parts[2].includes("..")) return null;
    return { folder: `${parts[0]}/${parts[1]}`, name: parts[2] };
}

/**
 * Vrai si l'une de ces adresses est déjà celle d'un média (publié ou non,
 * gratuit ou Premium). `service` doit être le client à clé de service : la
 * RLS cacherait les envois en attente et les fichiers Premium des autres.
 */
export async function urlsAreReferenced(service, urls) {
    const list = [...new Set(urls.filter(Boolean))];
    if (list.length === 0) return false;

    // Une requête par colonne plutôt qu'un `.or()` assemblé à la main : les
    // adresses contiennent des caractères que la syntaxe de filtre PostgREST
    // interprète.
    const lookups = await Promise.all([
        ...["url", "thumbnail_url", "original_url"].map((column) =>
            service.from("media").select("id").in(column, list).limit(1)
        ),
        ...["url", "original_url"].map((column) =>
            service.from("media_premium_files").select("media_id").in(column, list).limit(1)
        ),
    ]);

    for (const [index, result] of lookups.entries()) {
        // Table `media_premium_files` absente : base pas encore migrée (0025).
        if (result.error && index >= 3) continue;
        if (result.error) throw result.error;
        if ((result.data || []).length > 0) return true;
    }
    return false;
}

/** Vrai si ces chemins R2 sont déjà ceux d'un média. */
export function pathsAreReferenced(service, paths) {
    return urlsAreReferenced(service, paths.map(r2PublicUrl));
}

/** Dimensions affichées d'une image, rotation EXIF comprise. */
export function orientedSize(metadata) {
    const oriented = metadata.autoOrient;
    if (oriented?.width && oriented?.height) return { width: oriented.width, height: oriented.height };
    const swap = (metadata.orientation || 1) >= 5;
    return swap
        ? { width: metadata.height, height: metadata.width }
        : { width: metadata.width, height: metadata.height };
}

/** Deux formats d'image identiques à 2 % près. */
export function sameAspect(a, b) {
    if (!a.width || !a.height || !b.width || !b.height) return false;
    const ra = a.width / a.height;
    const rb = b.width / b.height;
    return Math.abs(ra - rb) / Math.max(ra, rb) <= 0.02;
}

/**
 * Vérifie que les trois fichiers d'un envoi forment bien UN seul média :
 * version web et vignette aux bonnes tailles, même format, même image
 * (empreinte perceptuelle, filigrane Premium toléré) que l'original quand
 * le serveur sait le décoder. Les dimensions renvoyées sont celles de
 * l'original (rotation EXIF comprise) ; à défaut (vidéo, HEIC...), celles
 * déclarées, recoupées avec la version web. L'aperçu flou est calculé ici.
 *
 * Renvoie `{ ok: true, width, height, blurDataURL }` ou
 * `{ ok: false, status, error }`.
 */
// Formats d'original que `sharp` ne sait pas décoder mais que les
// téléphones produisent couramment (photos d'iPhone).
const UNDECODABLE_ORIGINALS = /^image\/(heic|heif)(-sequence)?$/i;

export async function inspectMediaFiles({ isVideo, displayBuffer, thumbBuffer, originalBuffer = null, originalMime = "", declaredWidth, declaredHeight }) {
    const fail = (status, error) => ({ ok: false, status, error });

    let displayMeta;
    let thumbMeta;
    try {
        [displayMeta, thumbMeta] = await Promise.all([
            sharp(displayBuffer).metadata(),
            sharp(thumbBuffer).metadata(),
        ]);
    } catch {
        return fail(400, "Fichier image illisible ou corrompu.");
    }
    const displaySize = { width: displayMeta.width, height: displayMeta.height };
    const thumbSize = { width: thumbMeta.width, height: thumbMeta.height };

    let width = null;
    let height = null;
    let originalHash = null;
    if (!isVideo && originalBuffer) {
        try {
            const originalMeta = await sharp(originalBuffer, { failOn: "none" }).metadata();
            ({ width, height } = orientedSize(originalMeta));
            originalHash = await computeDHash(originalBuffer, { orient: true });
        } catch (error) {
            // HEIC d'iPhone : on retombe sur les dimensions déclarées,
            // recoupées ci-dessous avec la version web. Tout autre fichier
            // illisible est refusé, sans quoi n'importe quel contenu pourrait
            // passer pour un « original » sans être vérifié.
            if (!UNDECODABLE_ORIGINALS.test(originalMime)) {
                return fail(400, "Le fichier original est illisible ou dans un format non pris en charge.");
            }
            console.warn("[publication] original HEIC non décodable, dimensions déclarées retenues :", error.message);
            width = null;
            height = null;
            originalHash = null;
        }
    }
    if (!width || !height) {
        width = declaredWidth || null;
        height = declaredHeight || null;
    }
    if (!width || !height) {
        return fail(400, "Dimensions de l'image introuvables.");
    }

    const expectedDisplayEdge = Math.min(Math.max(width, height), DISPLAY_MAX_EDGE);
    const expectedThumbEdge = Math.min(Math.max(width, height), THUMBNAIL_MAX_EDGE);
    if (
        Math.abs(Math.max(displaySize.width, displaySize.height) - expectedDisplayEdge) > 4
        || Math.abs(Math.max(thumbSize.width, thumbSize.height) - expectedThumbEdge) > 4
        || !sameAspect(displaySize, { width, height })
        || !sameAspect(thumbSize, displaySize)
    ) {
        return fail(400, "Les fichiers envoyés ne correspondent pas entre eux. Réessayez l'envoi.");
    }

    // La vignette s'affiche dans toutes les grilles, l'original part au
    // téléchargement : ni l'une ni l'autre ne doit pouvoir remplacer
    // l'image contrôlée.
    const [displayHash, thumbHash] = await Promise.all([
        computeDHash(displayBuffer),
        computeDHash(thumbBuffer),
    ]);
    if (hammingDistance(displayHash, thumbHash) > SAME_IMAGE_HAMMING_THRESHOLD) {
        return fail(400, "La vignette ne correspond pas à l'image envoyée.");
    }
    if (originalHash && hammingDistance(displayHash, originalHash) > SAME_IMAGE_HAMMING_THRESHOLD) {
        return fail(400, "Le fichier original ne correspond pas à l'image envoyée.");
    }

    const blur = await sharp(displayBuffer)
        .resize(16, 16, { fit: "inside" })
        .jpeg({ quality: 50 })
        .toBuffer();

    return {
        ok: true,
        width,
        height,
        blurDataURL: `data:image/jpeg;base64,${blur.toString("base64")}`,
    };
}
