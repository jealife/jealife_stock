import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deleteR2Objects } from "../../lib/r2";
import { serviceClient } from "../../lib/server-supabase";
import { parseOwnedPath, pathsAreReferenced } from "../../lib/media-files";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Nettoyage best-effort des fichiers déjà envoyés sur R2 quand la publication
 * échoue après l'upload (ex: l'insertion en base échoue) : sans cela, ces
 * fichiers restent orphelins sur R2, non rattachés à aucune ligne `media` et
 * invisibles/supprimables nulle part dans l'admin.
 */
export async function POST(request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
        }

        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) {
            return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
        }

        // Token de l'appelant attaché : la vérification ci-dessous doit voir
        // ses médias quel que soit leur statut (un envoi en attente de
        // modération reste invisible pour un client anonyme).
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "Session invalide, reconnectez-vous." }, { status: 401 });
        }

        const { paths } = await request.json();
        if (!Array.isArray(paths) || paths.length === 0 || paths.length > 10) {
            return NextResponse.json({ error: "Aucun chemin fourni." }, { status: 400 });
        }

        // Même garde-fou que /api/r2-upload-url : personne ne peut faire
        // supprimer un fichier hors de son propre dossier.
        if (paths.some((path) => !parseOwnedPath(path, user.id))) {
            return NextResponse.json({ error: "Chemin non autorisé." }, { status: 403 });
        }

        // Cette route ne sert qu'à ramasser des fichiers orphelins, jamais à
        // vider une publication existante : on refuse tout chemin encore
        // utilisé par un média, Premium compris (ses vraies adresses vivent
        // dans une table que la RLS cache, d'où la clé de service).
        const service = serviceClient();
        if (!service) {
            return NextResponse.json({ error: "Clé de service Supabase manquante côté serveur." }, { status: 500 });
        }
        if (await pathsAreReferenced(service, paths)) {
            return NextResponse.json(
                { error: "Ces fichiers appartiennent à un média publié. Supprimez le média lui-même." },
                { status: 409 }
            );
        }

        await deleteR2Objects(paths);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur de nettoyage R2 :", error);
        return NextResponse.json({ error: "Impossible de nettoyer les fichiers." }, { status: 500 });
    }
}
