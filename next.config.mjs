// En-têtes de sécurité posés sur toutes les réponses. Pas de Content-Security-
// Policy stricte : Turnstile, Supabase, R2 et Vercel Analytics chargent depuis
// plusieurs domaines, et une politique trop large n'apporterait rien.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Empêche d'afficher le site dans un cadre d'un autre domaine
  // (détournement de clic sur « Télécharger », « Acheter »...).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  async redirects() {
    return [
      // L'ancien portail d'entrée a disparu. Le paramètre `next` n'est
      // volontairement pas suivi : une adresse comme `/\exemple.com` en
      // ferait une redirection ouverte vers un autre site.
      { source: "/verify", destination: "/", permanent: false },
    ];
  },

  images: {
    // AVIF puis WebP : à qualité perçue égale, une AVIF pèse environ 30 % de
    // moins qu'une JPEG. Sur un forfait mobile gabonais, cela se voit.
    formats: ["image/avif", "image/webp"],

    // Les images sont immuables une fois publiées (chaque envoi crée un
    // chemin horodaté) : un cache d'un an évite de les retélécharger.
    minimumCacheTTL: 31536000,

    // Next 16 refuse par défaut toute qualité hors de [75] et le répète en
    // boucle dans les logs : la liste doit couvrir toutes les valeurs
    // passées à `quality` sur les <Image> du site (PhotoCard, VideoCard,
    // Hero, PhotoDetail).
    qualities: [75, 85, 90],

    remotePatterns: [
      // Le stockage du projet Supabase. Le motif générique évite d'avoir à
      // modifier ce fichier — et de casser toutes les images en production —
      // le jour où le projet change de référence.
      { protocol: "https", hostname: "*.supabase.co" },
      // Stockage Cloudflare R2 (migration du stockage média, voir app/lib/r2.js).
      // Le sous-domaine public par défaut est `pub-<id>.r2.dev` ; si un
      // domaine personnalisé est connecté au bucket, ajoutez-le ici aussi.
      { protocol: "https", hostname: "*.r2.dev" },
      // Images de vitrine du site, hébergées sur le compte Unsplash de
      // l'auteur (voir app/lib/auth-images.js).
      { protocol: "https", hostname: "images.unsplash.com" },
      // Avatars de repli générés pour les comptes sans photo de profil.
      { protocol: "https", hostname: "api.dicebear.com" },
      // Photos de profil des comptes connectés via Google.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
