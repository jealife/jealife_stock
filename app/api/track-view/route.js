import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient, serviceClient, clientIp } from "../../lib/server-supabase";

/**
 * Enregistre une vue. Route serveur parce que c'est le seul endroit qui voit
 * l'adresse IP de l'appelant, nécessaire pour dédupliquer les vues anonymes
 * (voir migration 0014, `record_view`).
 *
 * Depuis la migration 0025, `record_view` n'est plus appelable qu'avec la
 * clé de service : en RPC directe, n'importe qui pouvait l'appeler en boucle
 * avec des clés inventées et gonfler les vues d'une photo. Sans clé de
 * service configurée, on retombe sur la clé publique (base pas encore
 * migrée).
 */
export async function POST(request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
        }

        const { mediaId } = await request.json();
        const id = Number(mediaId);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: "Média manquant." }, { status: 400 });
        }

        const token = bearerToken(request);
        const publicClient = userClient(null);
        const writer = serviceClient() || publicClient;

        let viewerId = null;
        if (token) {
            const { data: { user } } = await publicClient.auth.getUser(token);
            viewerId = user?.id || null;
        }

        // Préfère l'identité connectée (stable d'un appareil à l'autre) à
        // l'IP (partagée entre plusieurs visiteurs sur un même réseau,
        // mais c'est le seul repère disponible pour un visiteur anonyme).
        const viewerKey = viewerId ? `user:${viewerId}` : `ip:${clientIp(request)}`;

        // Généreux : parcourir un catalogue déclenche une vue par photo
        // consultée. Échoue ouvert (log + laisse passer) si la fonction est
        // indisponible : une vue non comptée est plus anodine qu'une
        // navigation bloquée.
        const { data: withinLimit, error: rateLimitError } = await writer.rpc("check_rate_limit", {
            p_key: viewerKey,
            p_bucket: "track-view",
            p_max_count: 120,
            p_window_seconds: 300,
        });
        if (rateLimitError) {
            console.error("Vérification de limite de débit impossible :", rateLimitError);
        } else if (!withinLimit) {
            return NextResponse.json({ success: false, throttled: true });
        }

        const { error } = await writer.rpc("record_view", {
            p_media_id: id,
            p_viewer_key: viewerKey,
        });
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur d'enregistrement de vue :", error);
        // Une vue manquée ne doit jamais faire échouer le chargement de la
        // page pour le visiteur : 200 avec success:false plutôt que 500.
        return NextResponse.json({ success: false });
    }
}
