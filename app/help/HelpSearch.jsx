"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

/** Comparaison sans accents ni majuscules : « telecharger » trouve « Télécharger ». */
function normalize(value) {
    return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Recherche instantanée dans les articles. Tant que le champ est vide, la
 * page affiche les catégories (`children`, rendues côté serveur).
 */
export default function HelpSearch({ articles, children }) {
    const [query, setQuery] = useState("");
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const results = terms.length
        ? articles.filter((article) => {
              const haystack = normalize(`${article.title} ${article.summary} ${article.text}`);
              return terms.every((term) => haystack.includes(term));
          })
        : [];

    return (
        <>
            <div className="relative max-w-xl mt-6">
                <label htmlFor="help-search" className="sr-only">Rechercher dans l&apos;aide</label>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                <input
                    id="help-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Télécharger, licence, publier, mot de passe…"
                    className="w-full h-12 pl-12 pr-4 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-500 dark:placeholder:text-zinc-400 outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600 transition-colors"
                />
            </div>

            <div className="mt-12">
                {terms.length === 0 ? (
                    children
                ) : results.length === 0 ? (
                    <p className="text-gray-500 dark:text-zinc-400">
                        Aucun article ne correspond à « {query} ». Essayez un autre mot, ou écrivez-nous (voir en bas de page).
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-zinc-800 border-y border-gray-200 dark:border-zinc-800">
                        {results.map((article) => (
                            <li key={article.slug}>
                                <Link href={`/help/${article.slug}`} className="block py-4 group">
                                    <span className="block font-medium text-gray-900 dark:text-zinc-100 group-hover:underline underline-offset-2">
                                        {article.title}
                                    </span>
                                    <span className="block text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{article.summary}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}
