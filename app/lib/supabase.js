import { createClient } from '@supabase/supabase-js';

/**
 * Supabase a renommé la clé publique : `anon` (JWT hérité) est devenue
 * `publishable` (`sb_publishable_…`). Les deux formes circulent encore, selon
 * l'âge du projet et l'onglet du tableau de bord où l'on copie la valeur.
 * On accepte les deux plutôt que d'imposer un nom : se tromper de variable ne
 * casse rien de visible au build, mais vide silencieusement tout le site.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// On ne lève pas d'erreur ici : cela ferait échouer le build Vercel avant même
// que les variables aient pu être renseignées.
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
        '⚠️ Variables Supabase manquantes. Renseignez NEXT_PUBLIC_SUPABASE_URL et ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    );
}

const isServer = typeof window === 'undefined';

/**
 * Côté serveur, ce client n'a jamais de session : il ne lit que des données
 * publiques (catalogue, profils, thèmes), identiques pour tous les visiteurs.
 * Sans cache, chaque affichage de l'accueil enchaînait une dizaine de
 * requêtes vers Supabase avant d'envoyer le moindre octet (3,8 s mesurées en
 * production). Les lectures (GET) passent désormais par le cache de données
 * de Next, cinq minutes au plus (le rythme de régénération des pages
 * publiques). Chaque écriture faite depuis le site (envoi, modification,
 * suppression, modération, profil) invalide aussitôt ce cache via
 * l'étiquette `supabase` (voir /api/revalidate) : la durée ne joue que pour
 * les changements faits ailleurs. Les écritures et les RPC (POST) ne sont
 * jamais mises en cache. Le navigateur, lui, garde le `fetch` normal : ses
 * requêtes portent la session du membre et ne doivent pas être partagées.
 */
export const SERVER_CACHE_SECONDS = 300;

function cachedServerFetch(input, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    if (method !== 'GET') return fetch(input, init);
    return fetch(input, { ...init, next: { revalidate: SERVER_CACHE_SECONDS, tags: ['supabase'] } });
}

export const supabase = createClient(
    SUPABASE_URL || 'https://placeholder-url.supabase.co',
    SUPABASE_KEY || 'placeholder-key',
    {
        auth: {
            // Rien à conserver ni à rafraîchir sur le serveur : il n'y a pas
            // de session, et un minuteur de rafraîchissement y tournerait
            // pour rien.
            persistSession: !isServer,
            autoRefreshToken: !isServer,
            detectSessionInUrl: !isServer,
        },
        ...(isServer ? { global: { fetch: cachedServerFetch } } : {}),
    }
);
