import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient, serviceClient } from "../../lib/server-supabase";
import { r2Configured, r2PublicUrl, headR2Object, readR2Object } from "../../lib/r2";
import { runModerationChecks, sha256, verifyModerationTicket } from "../../lib/moderation";
import { inspectMediaFiles, parseOwnedPath, pathsAreReferenced } from "../../lib/media-files";

// Lecture de l'original (jusqu'à 50 Mo) et contrôles d'image : plus long
// qu'une requête ordinaire. 60 s est le plafond du forfait Vercel Hobby.
export const maxDuration = 60;

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;
const MAX_DISPLAY_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const TYPES = new Set(["photo", "illustration", "video"]);

const text = (value, max) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().slice(0, max);
    return trimmed || null;
};

const positiveInt = (value, max) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= max ? number : null;
};

/**
 * Publication d'un média : SEULE porte d'entrée de la table `media`.
 *
 * Jusqu'ici, le navigateur écrivait lui-même la ligne après avoir appelé
 * /api/moderate-upload. Rien n'obligeait un client modifié à passer par ce
 * contrôle, ni à enregistrer les fichiers effectivement contrôlés : on
 * pouvait publier n'importe quelle image de son dossier R2, sans contrôle
 * qualité ni modération.
 *
 * Désormais :
 *   1. les fichiers sont relus sur R2 par le serveur, pas crus sur parole ;
 *   2. la version web doit être exactement celle contrôlée (ticket signé de
 *      /api/moderate-upload), sinon tous les contrôles sont refaits sur le
 *      fichier stocké ;
 *   3. vignette et original doivent être la même image que la version web
 *      (empreinte perceptuelle et format), une vignette filigranée comprise ;
 *   4. dimensions, aperçu flou, empreinte, taille et type de fichier sont
 *      calculés ici ;
 *   5. la ligne est écrite avec la clé de service : depuis la migration
 *      0026, le navigateur n'a plus le droit d'insérer dans `media`. Les
 *      déclencheurs (statut selon le mode de modération, compte suspendu,
 *      fichiers Premium, prix) s'appliquent comme avant.
 */
export async function POST(request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
        }
        if (!r2Configured) {
            return NextResponse.json({ error: "Cloudflare R2 n'est pas encore configuré côté serveur." }, { status: 500 });
        }
        const service = serviceClient();
        if (!service) {
            return NextResponse.json({ error: "Clé de service Supabase manquante côté serveur." }, { status: 500 });
        }

        const token = bearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
        }
        const supabase = userClient(token);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "Session invalide, reconnectez-vous." }, { status: 401 });
        }

        const { data: withinLimit, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
            p_key: user.id,
            p_bucket: "publish-media",
            p_max_count: 30,
            p_window_seconds: 300,
        });
        if (rateLimitError) {
            console.error("Vérification de limite de débit impossible :", rateLimitError);
        } else if (!withinLimit) {
            return NextResponse.json(
                { error: "Trop de publications en peu de temps. Patientez quelques minutes avant de réessayer." },
                { status: 429 }
            );
        }

        const body = await request.json();
        const type = TYPES.has(body.type) ? body.type : null;
        if (!type) {
            return NextResponse.json({ error: "Type de média inconnu." }, { status: 400 });
        }

        // ── Fichiers : dans le dossier du contributeur, un seul dossier par
        //    média, noms attendus, jamais déjà utilisés par un autre média.
        const paths = body.files || {};
        const thumb = parseOwnedPath(paths.thumbnail, user.id);
        const display = parseOwnedPath(paths.display, user.id);
        const original = parseOwnedPath(paths.original, user.id);
        if (
            !thumb || !display || !original
            || thumb.folder !== display.folder || display.folder !== original.folder
            || !/^thumb\.(webp|jpg)$/.test(thumb.name)
            || !/^display\.(webp|jpg)$/.test(display.name)
            || !/^original\.[a-z0-9]{1,5}$/.test(original.name)
        ) {
            return NextResponse.json({ error: "Chemins de fichiers non autorisés." }, { status: 403 });
        }

        // Réponse perdue en route (réseau mobile) puis requête renvoyée : la
        // publication a déjà eu lieu, on renvoie le média existant plutôt
        // qu'une erreur qui ferait croire à un échec.
        const { data: existing } = await service
            .from("media")
            .select("id, status, user_id")
            .eq("thumbnail_url", r2PublicUrl(paths.thumbnail))
            .maybeSingle();
        if (existing?.user_id === user.id) {
            return NextResponse.json({ id: existing.id, status: existing.status });
        }

        if (await pathsAreReferenced(service, [paths.thumbnail, paths.display, paths.original])) {
            return NextResponse.json({ error: "Ces fichiers appartiennent déjà à un média." }, { status: 409 });
        }

        const originalHead = await headR2Object(paths.original);
        if (!originalHead) {
            return NextResponse.json({ error: "Le fichier original n'a pas été reçu. Réessayez l'envoi." }, { status: 400 });
        }
        if (originalHead.size > MAX_ORIGINAL_BYTES) {
            return NextResponse.json({ error: "Le fichier dépasse la taille maximale de 50 Mo." }, { status: 413 });
        }
        const isVideo = type === "video";
        if (isVideo ? !originalHead.contentType.startsWith("video/") : !originalHead.contentType.startsWith("image/")) {
            return NextResponse.json({ error: "Le fichier original ne correspond pas au type de média." }, { status: 400 });
        }

        let displayFile;
        let thumbFile;
        try {
            [displayFile, thumbFile] = await Promise.all([
                readR2Object(paths.display, MAX_DISPLAY_BYTES),
                readR2Object(paths.thumbnail, MAX_THUMBNAIL_BYTES),
            ]);
        } catch (error) {
            console.error("Lecture des dérivés impossible :", error);
            return NextResponse.json({ error: "Les fichiers envoyés sont introuvables ou trop lourds. Réessayez l'envoi." }, { status: 400 });
        }

        // Original relu pour les photos et illustrations (dimensions réelles,
        // même image que la version web). Une vidéo n'est pas décodée ici :
        // ses dimensions déclarées sont recoupées avec la trame extraite.
        let originalBuffer = null;
        if (!isVideo) {
            try {
                ({ buffer: originalBuffer } = await readR2Object(paths.original, MAX_ORIGINAL_BYTES));
            } catch (error) {
                console.error("Lecture de l'original impossible :", error);
                return NextResponse.json({ error: "Le fichier original est illisible. Réessayez l'envoi." }, { status: 400 });
            }
        }

        const files = await inspectMediaFiles({
            isVideo,
            displayBuffer: displayFile.buffer,
            thumbBuffer: thumbFile.buffer,
            originalBuffer,
            originalMime: originalHead.contentType,
            declaredWidth: positiveInt(body.width, 100_000),
            declaredHeight: positiveInt(body.height, 100_000),
        });
        if (!files.ok) {
            return NextResponse.json({ error: files.error }, { status: files.status });
        }
        const { width, height } = files;

        // ── Contrôle qualité et modération : épargnés seulement si la version
        //    web stockée est exactement celle qui a été contrôlée.
        const digest = sha256(displayFile.buffer);
        let checked = verifyModerationTicket(body.ticket, { userId: user.id, digest });
        if (!checked) {
            const result = await runModerationChecks({
                supabase,
                userId: user.id,
                buffer: displayFile.buffer,
                mimeType: displayFile.contentType || "image/jpeg",
                originalWidth: width,
                originalHeight: height,
                type,
            });
            if (!result.ok) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }
            checked = { phash: result.phash, trusted: result.trusted };
        }

        const altText = text(body.altText, 200);
        if (!altText) {
            return NextResponse.json({ error: "Chaque image doit être décrite avant d'être publiée." }, { status: 400 });
        }

        const tags = Array.isArray(body.tags)
            ? [...new Set(body.tags.map((tag) => text(tag, 50)).filter(Boolean))].slice(0, 30)
            : [];
        const countryCode = typeof body.countryCode === "string" && /^[A-Z]{2}$/.test(body.countryCode)
            ? body.countryCode
            : null;
        const duration = isVideo && typeof body.duration === "string" && /^\d{1,4}:\d{2}$/.test(body.duration)
            ? body.duration
            : null;
        const isPremium = body.isPremium === true;
        const customPrice = isPremium ? positiveInt(body.customPrice, 1000) : null;
        const iso = positiveInt(body.iso, 10_000_000);

        // Un seul champ saisi sert de titre et de texte alternatif ; le
        // contributeur peut les dissocier ensuite depuis la page de
        // modification. Le statut n'est pas décidé ici : un déclencheur
        // l'impose selon le mode de modération choisi par un admin.
        const row = {
            user_id: user.id,
            type,
            url: r2PublicUrl(paths.display),
            original_url: r2PublicUrl(paths.original),
            thumbnail_url: r2PublicUrl(paths.thumbnail),
            blur_data_url: files.blurDataURL,
            phash: checked.phash,
            title: altText,
            alt_text: altText,
            description: text(body.description, 2000),
            camera: text(body.camera, 100),
            lens: text(body.lens, 100),
            focal_length: text(body.focalLength, 50),
            aperture: text(body.aperture, 50),
            shutter_speed: text(body.shutterSpeed, 50),
            iso,
            tags,
            location: text(body.location, 200),
            city: text(body.city, 100),
            country_code: countryCode,
            is_premium: isPremium,
            custom_credits_cost: customPrice,
            width,
            height,
            duration,
            file_size: originalHead.size,
            mime_type: originalHead.contentType || null,
        };

        const { data: media, error: insertError } = await service
            .from("media")
            .insert(row)
            .select("id, status")
            .single();

        if (insertError?.code === "23505") {
            // Requête jumelle arrivée juste avant (double envoi) : même
            // réponse que pour une publication déjà faite.
            const { data: twin } = await service
                .from("media")
                .select("id, status, user_id")
                .eq("thumbnail_url", row.thumbnail_url)
                .maybeSingle();
            if (twin?.user_id === user.id) {
                return NextResponse.json({ id: twin.id, status: twin.status });
            }
        }
        if (insertError) {
            // Erreurs levées par les déclencheurs (compte suspendu, prix hors
            // fourchette...) : leur message est déjà rédigé pour le contributeur.
            if (insertError.code === "42501" || insertError.code === "P0001") {
                return NextResponse.json({ error: insertError.message }, { status: 403 });
            }
            throw insertError;
        }

        // En modération manuelle, le déclencheur met tout envoi en attente.
        // Un admin publiait jusqu'ici directement (le navigateur écrivait
        // avec sa session) : on garde ce comportement.
        let status = media.status;
        if (status === "pending") {
            const { data: isAdmin } = await supabase.rpc("is_admin");
            if (isAdmin) {
                const { error: approveError } = await service.from("media").update({ status: "published" }).eq("id", media.id);
                if (!approveError) status = "published";
            }
        }

        return NextResponse.json({ id: media.id, status });
    } catch (error) {
        console.error("Erreur de publication :", error);
        return NextResponse.json({ error: "La publication a échoué. Réessayez." }, { status: 500 });
    }
}
