import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient } from "../../lib/server-supabase";
import { runModerationChecks, sha256, signModerationTicket } from "../../lib/moderation";

/**
 * Contrôle qualité AVANT l'envoi des fichiers (voir app/submit/SubmitForm.jsx) :
 * le contributeur est prévenu tout de suite, sans avoir téléversé pour rien
 * un original de plusieurs dizaines de Mo.
 *
 * Ce contrôle seul ne publie rien et ne suffit plus à publier : c'est
 * /api/publish-media qui écrit la ligne `media`, après avoir relu la version
 * web déposée sur R2. Le ticket signé renvoyé ici lui évite de refaire les
 * contrôles (et l'appel IA payant) quand les octets stockés sont exactement
 * ceux contrôlés ici.
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

        // Client attaché au token de l'appelant : les requêtes respectent la
        // RLS comme si elles venaient de l'utilisateur lui-même.
        const supabase = userClient(token);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "Session invalide, reconnectez-vous." }, { status: 401 });
        }

        // Cette route appelle l'API Gemini (payante) et fait tourner `sharp` :
        // sans limite, un compte compromis ou un client qui boucle peut faire
        // exploser la facture. 30 : trois lots complets de 10 images par
        // fenêtre. Échoue ouvert si la table de comptage manque.
        const { data: withinLimit, error: rateLimitError } = await supabase.rpc("check_rate_limit", {
            p_key: user.id,
            p_bucket: "moderate-upload",
            p_max_count: 30,
            p_window_seconds: 300,
        });
        if (rateLimitError) {
            console.error("Vérification de limite de débit impossible :", rateLimitError);
        } else if (!withinLimit) {
            return NextResponse.json(
                { error: "Trop d'envois en peu de temps. Patientez quelques minutes avant de réessayer." },
                { status: 429 }
            );
        }

        const { image, mimeType, originalWidth, originalHeight, type } = await request.json();
        if (!image) {
            return NextResponse.json({ error: "Aucune image fournie." }, { status: 400 });
        }

        const buffer = Buffer.from(image, "base64");
        const result = await runModerationChecks({
            supabase,
            userId: user.id,
            buffer,
            mimeType,
            originalWidth: Number(originalWidth),
            originalHeight: Number(originalHeight),
            type,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const ticket = signModerationTicket({
            userId: user.id,
            digest: sha256(buffer),
            phash: result.phash,
            trusted: result.trusted,
        });

        return NextResponse.json({ ok: true, phash: result.phash, trusted: result.trusted, ticket });
    } catch (error) {
        console.error("Erreur de contrôle qualité :", error);
        return NextResponse.json({ error: "La vérification de l'image a échoué. Réessayez." }, { status: 500 });
    }
}
