import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY, bearerToken, userClient, readPremiumFiles } from "../../lib/server-supabase";

/**
 * Seule route qui renvoie l'adresse réelle (affichage pleine taille ou
 * fichier original) d'un média Premium. Partout ailleurs (page photo, plan
 * du site, fiche Open Graph, cartes de grille), l'application ne reçoit
 * jamais ces deux champs pour un média Premium, seulement sa vignette.
 *
 * Depuis la migration 0025, ce n'est plus seulement l'interface qui le
 * garantit : les vraies adresses d'un média Premium vivent dans
 * `media_premium_files`, que la base ne laisse lire qu'à l'auteur, à un
 * acheteur ou à un admin. Cette route se contente donc d'interroger la base
 * avec la session du visiteur : la RLS est le seul arbitre.
 *
 * Sert aussi aux cartes de grille, qui ne connaissent que la vignette d'un
 * média gratuit et demandent ici ses adresses au moment du téléchargement.
 */
export async function POST(request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return NextResponse.json({ error: "Configuration Supabase manquante." }, { status: 500 });
        }

        const { mediaId } = await request.json();
        const id = Number(mediaId);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ error: "mediaId manquant." }, { status: 400 });
        }

        const token = bearerToken(request);
        const supabase = userClient(token);

        // Pas de filtre sur le statut : la RLS ne montre de toute façon un
        // envoi non publié qu'à son auteur (et aux admins), qui doit pouvoir
        // retrouver ses propres fichiers pendant la modération.
        const { data: media, error: mediaError } = await supabase
            .from("media")
            .select("id, user_id, is_premium, url, original_url")
            .eq("id", id)
            .maybeSingle();

        if (mediaError || !media) {
            return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
        }

        if (!media.is_premium) {
            return NextResponse.json({ url: media.url, originalUrl: media.original_url });
        }

        const locked = NextResponse.json({ url: null, originalUrl: null });
        if (!token) return locked;

        const files = await readPremiumFiles(supabase, id);
        if (files) {
            return NextResponse.json({ url: files.url, originalUrl: files.original_url });
        }

        // Base pas encore migrée (0025) : les adresses sont encore dans
        // `media`. On revérifie alors le droit d'accès ici, comme avant.
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return locked;

        let allowed = user.id === media.user_id;
        if (!allowed) {
            const { data: isAdmin } = await supabase.rpc("is_admin");
            allowed = !!isAdmin;
        }
        if (!allowed) {
            const { data: purchase } = await supabase
                .from("premium_downloads")
                .select("id")
                .eq("media_id", id)
                .eq("buyer_id", user.id)
                .limit(1)
                .maybeSingle();
            allowed = !!purchase;
        }
        if (!allowed || media.url === null) return locked;

        return NextResponse.json({ url: media.url, originalUrl: media.original_url });
    } catch (error) {
        console.error("Erreur photo-access:", error);
        return NextResponse.json({ error: "Impossible de vérifier l'accès à ce média." }, { status: 500 });
    }
}
