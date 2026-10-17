import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient, serviceClient, clientIp } from "../../lib/server-supabase";

/**
 * Compte un téléchargement.
 *
 *   · Membre connecté : `increment_downloads` avec sa session, qui alimente
 *     aussi son historique (« Mes téléchargements »).
 *   · Visiteur anonyme : `record_anonymous_download` (migration 0025), avec
 *     la clé de service, dédupliqué par IP et par jour comme les vues.
 *     Avant, ces téléchargements n'étaient jamais comptés, alors que ce sont
 *     les plus nombreux sur une banque d'images.
 *
 * Ne fait jamais échouer le téléchargement lui-même : le fichier est déjà
 * enregistré sur l'appareil quand cette route est appelée.
 */
export async function POST(request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return NextResponse.json({ success: false });
        }

        const { mediaId } = await request.json();
        const id = Number(mediaId);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: "Média manquant." }, { status: 400 });
        }

        const token = bearerToken(request);
        if (token) {
            const member = userClient(token);
            const { data: { user } } = await member.auth.getUser(token);
            if (user) {
                const { error } = await member.rpc("increment_downloads", { media_id: id });
                if (error) throw error;
                return NextResponse.json({ success: true });
            }
        }

        const service = serviceClient();
        if (!service) return NextResponse.json({ success: false });

        const viewerKey = `ip:${clientIp(request)}`;
        const { data: withinLimit, error: rateLimitError } = await service.rpc("check_rate_limit", {
            p_key: viewerKey,
            p_bucket: "track-download",
            p_max_count: 60,
            p_window_seconds: 300,
        });
        if (rateLimitError) {
            console.error("Vérification de limite de débit impossible :", rateLimitError);
        } else if (!withinLimit) {
            return NextResponse.json({ success: false, throttled: true });
        }

        const { error } = await service.rpc("record_anonymous_download", {
            p_media_id: id,
            p_viewer_key: viewerKey,
        });
        // Base pas encore migrée (0025) : la fonction n'existe pas encore.
        if (error && error.code !== "PGRST202") throw error;

        return NextResponse.json({ success: !error });
    } catch (error) {
        console.error("Erreur d'enregistrement de téléchargement :", error);
        return NextResponse.json({ success: false });
    }
}
