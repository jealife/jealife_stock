import Link from "next/link";
import Image from "next/image";
import { formatCount } from "../lib/media";

/**
 * Thèmes mis en avant.
 *
 * Composant serveur : les thèmes arrivent déjà chargés (voir app/page.js).
 * La version précédente, côté navigateur, lançait une requête par thème
 * sans couverture après l'affichage de la page (jusqu'à neuf allers-retours
 * sur une connexion mobile, pour quatre vignettes en bas de page).
 * `getTopics` complète déjà la couverture manquante d'un thème avec une de
 * ses photos publiées : seuls les thèmes qui ont réellement du contenu sont
 * montrés, une vignette vide donnant l'impression d'un site abandonné.
 */
export default function FeaturedTopics({ topics = [] }) {
    const visible = topics.filter((topic) => topic.cover_image_url && topic.total_media > 0).slice(0, 4);
    if (visible.length === 0) return null;

    return (
        <section className="w-full max-w-[1600px] mx-auto px-4 py-16 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Thèmes à explorer</h2>
                <Link href="/themes" className="text-sm font-bold text-gray-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors">
                    Tous les thèmes
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {visible.map((topic) => (
                    <Link
                        key={topic.slug}
                        href={`/themes/${topic.slug}`}
                        className="group relative h-64 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800"
                    >
                        {/* Vignette déjà dimensionnée pour le web (800 px) :
                            l'optimiseur d'images de Vercel n'apporterait
                            rien de plus et consommerait le quota. */}
                        <Image
                            src={topic.cover_image_url}
                            alt=""
                            fill
                            unoptimized
                            loading="lazy"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                        <div className="absolute bottom-0 left-0 p-6 text-white">
                            <h3 className="text-xl font-bold mb-1">{topic.name}</h3>
                            <p className="text-xs text-white/80 font-medium">
                                {formatCount(topic.total_media)} image{topic.total_media > 1 ? "s" : ""}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
