import Link from "next/link";
import { Camera, Heart, Globe } from "lucide-react";
import { getPlatformStats, getHeroBackground, getMedia } from "../lib/database";
import { pickShowcaseImage } from "../lib/auth-images";
import { formatCount } from "../lib/media";

export const metadata = {
    title: "À propos",
    description:
        "JEaLiFe Stock est une banque d'images libres de droits qui met en avant le Gabon et l'Afrique, portée par des photographes qui gardent leurs droits.",
    alternates: { canonical: "/about" },
};

export const revalidate = 300;

/**
 * Cette page affichait « 10k+ Photos », « 54M Téléchargements »,
 * « 2500+ Contributeurs » — des chiffres inventés, sur un catalogue qui n'en
 * contenait aucun. Les vrais chiffres viennent de `platform_stats`, la même
 * source que le hero de la page d'accueil : une catégorie
 * encore modeste le dit franchement plutôt que de mentir.
 */
export default async function AboutPage() {
    // Uniquement des photos du catalogue : la page présentait une vidéo
    // Pexels et des images Unsplash sans rapport avec le site.
    const [stats, heroPhoto, latest] = await Promise.all([
        getPlatformStats(),
        getHeroBackground(),
        getMedia({ type: "photo", limit: 12 }),
    ]);
    const hero = heroPhoto || pickShowcaseImage();
    const showcase = (latest || []).filter((item) => !item.is_premium && item.thumbnail_url).slice(0, 2);
    const totalMedia =
        (stats.total_photos || 0) + (stats.total_illustrations || 0) + (stats.total_videos || 0);

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
            <section className="relative h-[420px] md:h-[520px] flex items-center overflow-hidden bg-zinc-900 text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.thumbnailUrl || hero.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/55" />
                <div className="relative z-10 w-full max-w-[880px] mx-auto px-5 md:px-8">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        Des images pour tous les créateurs.
                    </h1>
                    <p className="mt-4 text-lg md:text-xl text-white/90 max-w-2xl leading-relaxed">
                        Une banque d&apos;images libres de droits qui met en avant le Gabon et le continent africain.
                    </p>
                </div>
            </section>

            {/* Mission Section */}
            <div className="max-w-[1320px] mx-auto px-5 py-20 md:py-24">
                <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">Une banque d&apos;images qui a du caractère.</h2>
                        <div className="prose prose-lg text-gray-600 dark:text-zinc-400 space-y-6">
                            <p>
                                JEaLiFe Stock est né d&apos;une idée simple : de belles images ne devraient pas être enfermées derrière des murs payants.
                            </p>
                            <p>
                                Nous relions des photographes à des créateurs (designers, écrivains, artistes, entrepreneurs) qui ont besoin d&apos;images authentiques pour raconter leurs histoires.
                            </p>
                            <p>
                                Une collection personnelle devenue une plateforme ouverte aux photographes qui veulent la faire grandir.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {showcase.map((item, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={item.id}
                                src={item.thumbnail_url}
                                alt={item.alt_text || item.title || ""}
                                loading="lazy"
                                className={`rounded-md w-full h-64 object-cover ${index === 0 ? "mb-8" : "mt-8"}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Section — chiffres réels, pas une estimation */}
            <div className="bg-gray-950 text-white py-20 md:py-28">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                        <div className="p-6">
                            <div className="flex justify-center mb-6">
                                <Camera className="w-10 h-10 text-gray-400" />
                            </div>
                            <div className="text-5xl font-bold mb-2 tracking-tight">
                                {totalMedia > 0 ? formatCount(totalMedia) : "0"}
                            </div>
                            <div className="text-white/60 text-sm">
                                Photos &amp; vidéos publiées
                            </div>
                        </div>
                        <div className="p-6 border-y md:border-y-0 md:border-x border-gray-800">
                            <div className="flex justify-center mb-6">
                                <Heart className="w-10 h-10 text-gray-400" />
                            </div>
                            <div className="text-5xl font-bold mb-2 tracking-tight">
                                {stats.total_downloads > 0 ? formatCount(stats.total_downloads) : "0"}
                            </div>
                            <div className="text-white/60 text-sm">
                                Téléchargements
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-center mb-6">
                                <Globe className="w-10 h-10 text-gray-400" />
                            </div>
                            <div className="text-5xl font-bold mb-2 tracking-tight">
                                {stats.total_contributors > 0 ? formatCount(stats.total_contributors) : "0"}
                            </div>
                            <div className="text-white/60 text-sm">
                                Contributeur{stats.total_contributors > 1 ? "s" : ""}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team CTA */}
            <div className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Rejoignez l&apos;aventure</h2>
                <p className="text-lg text-gray-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
                    JEaLiFe Stock démarre. Chaque photographe qui publie aujourd&apos;hui façonne ce que
                    la plateforme devient.
                </p>
                <Link href="/submit" className="btn btn-primary btn-lg">
                    Publier une image
                </Link>
            </div>
        </div>
    );
}
