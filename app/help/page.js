import Link from "next/link";
import HelpSearch from "./HelpSearch";
import { ARTICLES, CATEGORIES, CONTACT_EMAIL, articlesInCategory } from "./articles";

export const metadata = {
    title: "Centre d'aide",
    description:
        "Télécharger, utiliser la licence, publier ses images, gérer son compte : toutes les réponses sur JEaLiFe Stock.",
    alternates: { canonical: "/help" },
};

/** Texte brut d'un article, pour la recherche. */
function plainText(article) {
    return article.body
        .flatMap((block) => block.items || [block.text])
        .join(" ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export default function HelpPage() {
    const searchable = ARTICLES.map((article) => ({
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        text: plainText(article),
    }));

    return (
        <main className="min-h-screen bg-white dark:bg-zinc-950">
            <div className="max-w-[1080px] mx-auto px-4 sm:px-5 py-12 md:py-16">
                <h1 className="text-3xl md:text-[40px] leading-tight font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                    Centre d&apos;aide
                </h1>
                <p className="mt-3 text-gray-500 dark:text-zinc-400 max-w-xl">
                    Tout ce qu&apos;il faut savoir pour télécharger, utiliser et publier des images sur JEaLiFe Stock.
                </p>

                <HelpSearch articles={searchable}>
                    <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
                        {CATEGORIES.map((category) => (
                            <section key={category.slug} aria-labelledby={`cat-${category.slug}`}>
                                <h2 id={`cat-${category.slug}`} className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                                    {category.title}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{category.description}</p>
                                <ul className="mt-4 border-t border-gray-200 dark:border-zinc-800">
                                    {articlesInCategory(category.slug).map((article) => (
                                        <li key={article.slug} className="border-b border-gray-200 dark:border-zinc-800">
                                            <Link
                                                href={`/help/${article.slug}`}
                                                className="block py-3 text-[15px] text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:underline underline-offset-2"
                                            >
                                                {article.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </HelpSearch>

                <section className="mt-16 pt-8 border-t border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-zinc-100">Vous ne trouvez pas votre réponse ?</h2>
                        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Écrivez-nous par e-mail, nous vous répondrons.</p>
                    </div>
                    <a href={`mailto:${CONTACT_EMAIL}`} className="btn btn-secondary self-start">
                        {CONTACT_EMAIL}
                    </a>
                </section>
            </div>
        </main>
    );
}
