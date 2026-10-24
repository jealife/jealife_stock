import Link from "next/link";
import { getTopics } from "../lib/database";
import { formatCount } from "../lib/media";

export const revalidate = 600;

export const metadata = {
    title: "Tous les thèmes",
    description:
        "Parcourez les images libres de droits de JEaLiFe Stock par thème : nature, culture, portrait, vie quotidienne, architecture et bien d'autres.",
};

export default async function TopicsPage() {
    // `kind: 'category'` : cette page reste la vitrine choisie par l'équipe
    // (voir /admin/topics), pas une liste de tous les mots-clés jamais tapés
    // par un contributeur — sinon elle grossirait sans fin (migration 0006).
    const topics = await getTopics({ limit: 200, kind: "category", withCovers: true });
    const withMedia = topics.filter((topic) => topic.total_media > 0);
    const empty = topics.filter((topic) => topic.total_media === 0);

    return (
        <main className="min-h-screen bg-white dark:bg-zinc-950">
            <div className="max-w-[1320px] mx-auto px-4 sm:px-5 py-12 md:py-16">
                <header className="max-w-2xl mb-10 md:mb-12">
                    <h1 className="text-3xl md:text-[40px] leading-tight font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                        Thèmes
                    </h1>
                    <p className="mt-3 text-gray-500 dark:text-zinc-400">
                        La structure choisie par JEaLiFe Stock pour parcourir le catalogue :
                        chaque image publiée y est rattachée selon ses mots-clés.
                    </p>
                </header>

                {withMedia.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 mb-16">
                        {withMedia.map((topic) => (
                            <Link key={topic.slug} href={`/themes/${topic.slug}`} className="group">
                                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-gray-100 dark:bg-zinc-800">
                                    {topic.cover_image_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={topic.cover_image_url}
                                            alt=""
                                            loading="lazy"
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                </div>
                                <h2 className="mt-3 font-semibold text-gray-900 dark:text-zinc-100">
                                    {topic.name}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                                    {formatCount(topic.total_media)} image{topic.total_media > 1 ? "s" : ""}
                                    {topic.description && <> · {topic.description}</>}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}

                {empty.length > 0 && (
                    <section className="border-t border-gray-200 dark:border-zinc-800 pt-8">
                        <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-4">
                            Thèmes en attente de leurs premières images
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {empty.map((topic) => (
                                <Link
                                    key={topic.slug}
                                    href={`/themes/${topic.slug}`}
                                    className="px-3 h-8 inline-flex items-center bg-gray-100 dark:bg-zinc-800 rounded-md text-sm text-gray-600 dark:text-zinc-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-zinc-700 dark:hover:text-white transition-colors"
                                >
                                    {topic.name}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
