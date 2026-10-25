import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ArticleBody from "../ArticleBody";
import { CONTACT_EMAIL, articlesInCategory, categoryOf, findArticle, ARTICLES } from "../articles";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "../../lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
    return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const article = findArticle(slug);
    if (!article) return {};
    return {
        title: article.title,
        description: article.summary,
        alternates: { canonical: `/help/${article.slug}` },
    };
}

export default async function HelpArticlePage({ params }) {
    const { slug } = await params;
    const article = findArticle(slug);
    if (!article) notFound();

    const category = categoryOf(article);
    const related = articlesInCategory(article.category).filter((item) => item.slug !== article.slug);

    const breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Centre d'aide", item: absoluteUrl("/help") },
            { "@type": "ListItem", position: 3, name: article.title, item: absoluteUrl(`/help/${article.slug}`) },
        ],
    };

    return (
        <main className="min-h-screen bg-white dark:bg-zinc-950">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumb) }} />

            <div className="max-w-[1080px] mx-auto px-4 sm:px-5 py-10 md:py-14 grid lg:grid-cols-[1fr_260px] gap-12">
                <article className="max-w-[680px]">
                    <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500 dark:text-zinc-400">
                        <Link href="/help" className="inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                            Centre d&apos;aide
                        </Link>
                        {category && <span> · {category.title}</span>}
                    </nav>

                    <h1 className="mt-4 text-3xl md:text-[36px] leading-tight font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                        {article.title}
                    </h1>
                    <p className="mt-3 text-lg text-gray-500 dark:text-zinc-400">{article.summary}</p>

                    <div className="mt-8">
                        <ArticleBody blocks={article.body} />
                    </div>

                    <div className="mt-12 pt-6 border-t border-gray-200 dark:border-zinc-800 text-sm text-gray-500 dark:text-zinc-400">
                        Une question sans réponse ?{" "}
                        <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-900 dark:text-white underline underline-offset-2">
                            Écrivez-nous
                        </a>
                        .
                    </div>
                </article>

                {related.length > 0 && (
                    <aside className="lg:pt-12">
                        <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-400">
                            Dans « {category?.title} »
                        </h2>
                        <ul className="mt-3 space-y-3">
                            {related.map((item) => (
                                <li key={item.slug}>
                                    <Link
                                        href={`/help/${item.slug}`}
                                        className="text-[15px] text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:underline underline-offset-2"
                                    >
                                        {item.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </aside>
                )}
            </div>
        </main>
    );
}
