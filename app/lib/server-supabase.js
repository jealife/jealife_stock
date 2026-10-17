import { createClient } from "@supabase/supabase-js";

/**
 * Outils partagés des routes serveur (app/api/*). Ne jamais importer depuis
 * un composant client : ce module lit la clé de service.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Jeton Supabase transmis par le navigateur (`Authorization: Bearer ...`). */
export function bearerToken(request) {
    return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

/** Client qui agit au nom du visiteur : la RLS s'applique comme dans le navigateur. */
export function userClient(token) {
    return createClient(SUPABASE_URL, SUPABASE_KEY, {
        ...NO_SESSION,
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

/**
 * Client à clé de service, ou `null` si elle n'est pas configurée. Réservé
 * aux opérations que la base n'accorde qu'au serveur (journal des vues et
 * des téléchargements anonymes, voir migration 0025).
 */
export function serviceClient() {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
    return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, NO_SESSION);
}

/** Adresse IP du visiteur, telle que la transmet Vercel. */
export function clientIp(request) {
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return "unknown";
}

/**
 * Vraies adresses d'un média Premium (migration 0025). La RLS de
 * `media_premium_files` ne les rend qu'à l'auteur, à un acheteur ou à un
 * admin : avec un autre client, la réponse est simplement vide. Renvoie
 * `null` si rien n'est lisible, ou si la migration n'est pas encore appliquée.
 */
export async function readPremiumFiles(client, mediaId) {
    const { data, error } = await client
        .from("media_premium_files")
        .select("url, original_url")
        .eq("media_id", mediaId)
        .maybeSingle();
    if (error) return null;
    return data || null;
}
