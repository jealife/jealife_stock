import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient } from "../../lib/server-supabase";

/**
 * Rafraîchit les pages publiques après une écriture (envoi, modification,
 * suppression, décision de modération, profil).
 *
 * Les lectures du serveur sont mises en cache quelques minutes (voir
 * lib/supabase.js) et les fiches photo, profils et collections sont servies
 * depuis le cache de Vercel (ISR). Sans ce signal, un contributeur qui
 * corrige le titre de sa photo continuait de voir l'ancien pendant
 * plusieurs minutes, et un média retiré restait visible d'autant.
 *
 * Réservé aux membres connectés, et limité en fréquence : chaque appel
 * oblige les pages suivantes à se recalculer.
 */
export async function POST(request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
        }

        const token = bearerToken(request);
        if (!token) {
            return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
        }

        const supabase = userClient(token);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "Session invalide." }, { status: 401 });
        }

        const { data: withinLimit, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
            p_key: user.id,
            p_bucket: "revalidate",
            p_max_count: 30,
            p_window_seconds: 300,
        });
        if (rateLimitError) {
            console.error("Vérification de limite de débit impossible :", rateLimitError);
        } else if (!withinLimit) {
            return NextResponse.json({ success: false, throttled: true }, { status: 429 });
        }

        // Données expirées tout de suite (et non simplement marquées
        // « périmées ») : la personne qui vient de modifier sa photo doit
        // voir sa correction au prochain affichage, pas au suivant. Les
        // pages servies depuis le cache (fiches, profils, collections)
        // dépendent de ces lectures étiquetées : elles sont invalidées avec.
        revalidateTag("supabase", { expire: 0 });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur de rafraîchissement du cache :", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
