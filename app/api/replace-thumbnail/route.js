import sharp from "sharp";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient, serviceClient, readPremiumFiles } from "../../lib/server-supabase";
import { r2Configured, r2PublicUrl, r2KeyFromUrl, readR2Object, deleteR2Objects } from "../../lib/r2";
import { THUMBNAIL_MAX_EDGE } from "../../lib/images";
import { SAME_IMAGE_HAMMING_THRESHOLD, computeDHash, hammingDistance } from "../../lib/moderation";
import { parseOwnedPath, pathsAreReferenced, sameAspect } from "../../lib/media-files";

/**
 * Remplace la vignette d'un média déjà publié : passage Gratuit ↔ Premium
 * depuis la page de modification (vignette avec ou sans filigrane).
 *
 * La page réécrivait jusqu'ici le fichier en place, au même chemin R2. Or
 * /api/r2-upload-url signait n'importe quel chemin du dossier du membre, y
 * compris ceux de photos déjà publiées : on pouvait remplacer après coup la
 * vignette d'une photo validée (celle qu'affichent toutes les grilles) par
 * n'importe quelle image, sans aucun contrôle. Les fichiers d'un média sont
 * désormais immuables : la nouvelle vignette est déposée à un nouveau
 * chemin, vérifiée ici (même image que la version web), puis enregistrée.
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

        const { mediaId, path } = await request.json();
        const id = Number(mediaId);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: "Média manquant." }, { status: 400 });
        }

        const { data: media, error: mediaError } = await supabase
            .from("media")
            .select("id, user_id, url, thumbnail_url, is_premium")
            .eq("id", id)
            .maybeSingle();
        if (mediaError) throw mediaError;
        if (!media || media.user_id !== user.id) {
            return NextResponse.json({ error: "Vous n'êtes pas autorisé à modifier ce média." }, { status: 403 });
        }

        const parsed = parseOwnedPath(path, user.id);
        const currentKey = r2KeyFromUrl(media.thumbnail_url);
        const currentFolder = currentKey ? currentKey.split("/").slice(0, 2).join("/") : null;
        if (!parsed || parsed.folder !== currentFolder || !/^thumb[A-Za-z0-9-]*\.(webp|jpg)$/.test(parsed.name)) {
            return NextResponse.json({ error: "Chemin de fichier non autorisé." }, { status: 403 });
        }
        if (await pathsAreReferenced(service, [path])) {
            return NextResponse.json({ error: "Ce fichier appartient déjà à un média." }, { status: 409 });
        }

        // Version web de référence : pour un média Premium, elle vit dans la
        // table privée (migration 0025), lisible par son auteur.
        const premiumFiles = media.is_premium ? await readPremiumFiles(supabase, id) : null;
        const displayKey = r2KeyFromUrl(premiumFiles?.url || media.url);
        if (!displayKey) {
            return NextResponse.json({ error: "Version web introuvable pour ce média." }, { status: 400 });
        }

        let displayFile;
        let thumbFile;
        try {
            [displayFile, thumbFile] = await Promise.all([
                readR2Object(displayKey, 15 * 1024 * 1024),
                readR2Object(path, 5 * 1024 * 1024),
            ]);
        } catch (error) {
            console.error("Lecture des fichiers impossible :", error);
            return NextResponse.json({ error: "La nouvelle vignette est introuvable. Réessayez." }, { status: 400 });
        }

        const [displayMeta, thumbMeta] = await Promise.all([
            sharp(displayFile.buffer).metadata(),
            sharp(thumbFile.buffer).metadata(),
        ]);
        const [displayHash, thumbHash] = await Promise.all([
            computeDHash(displayFile.buffer),
            computeDHash(thumbFile.buffer),
        ]);
        if (
            Math.max(thumbMeta.width, thumbMeta.height) > THUMBNAIL_MAX_EDGE + 4
            || !sameAspect(thumbMeta, displayMeta)
            || hammingDistance(displayHash, thumbHash) > SAME_IMAGE_HAMMING_THRESHOLD
        ) {
            return NextResponse.json({ error: "La vignette ne correspond pas à cette photo." }, { status: 400 });
        }

        // Média Premium : `url` porte déjà la vignette (voir migration
        // 0025). Elle suit donc la nouvelle vignette ; sans quoi le
        // déclencheur prendrait l'ancienne vignette pour une vraie version
        // web et la rangerait parmi les fichiers privés.
        const newUrl = r2PublicUrl(path);
        const updates = media.is_premium && media.url === media.thumbnail_url
            ? { thumbnail_url: newUrl, url: newUrl }
            : { thumbnail_url: newUrl };

        const { error: updateError } = await service.from("media").update(updates).eq("id", id);
        if (updateError) throw updateError;

        if (currentKey) {
            await deleteR2Objects([currentKey]).catch((error) =>
                console.error("Suppression de l'ancienne vignette impossible :", error)
            );
        }

        return NextResponse.json({ success: true, thumbnailUrl: newUrl });
    } catch (error) {
        console.error("Erreur de remplacement de vignette :", error);
        return NextResponse.json({ error: "Impossible de remplacer la vignette." }, { status: 500 });
    }
}
