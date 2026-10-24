"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getTopics, getSearchTypeCounts } from "../lib/database";
import CountryFilter from "./CountryFilter";
import SortControl from "./SortControl";
import OrientationFilter from "./OrientationFilter";

/**
 * Barre de navigation par thème.
 *
 * Trois corrections :
 *   · les thèmes affichés étaient une liste codée en dur copiée d'Unsplash
 *     (« Street Photography », « Film »…), complétée par… un seul thème de la
 *     base, à cause d'un `.slice(0, 1)` là où le commentaire annonçait 15 ;
 *   · les liens pointaient vers `/?q=<nom>`, une simple recherche texte, alors
 *     que la table `media_topics` existe justement pour offrir de vraies pages
 *     de thème ;
 *   · aucun filtre géographique n'était proposé, alors que c'est la promesse
 *     centrale du site.
 */
export default function TopicBar({ activeTopic = null }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const scrollRef = useRef(null);
    const [topics, setTopics] = useState([]);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const [typeCounts, setTypeCounts] = useState(null);

    const query = searchParams.get("q");
    const country = searchParams.get("pays");
    const orientation = searchParams.get("orientation");

    useEffect(() => {
        // `kind: 'category'` exclut les tags nés d'un envoi (migration 0006) :
        // cette barre doit rester une liste choisie, bornée — pas grossir
        // avec chaque mot-clé inédit tapé par un contributeur.
        getTopics({ limit: 30, kind: "category" }).then(setTopics);
    }, []);

    // Compteurs par type pendant une recherche : sans eux, rien n'indique
    // avant de cliquer si l'onglet Illustrations a le moindre résultat.
    useEffect(() => {
        let cancelled = false;

        if (!query) {
            Promise.resolve().then(() => { if (!cancelled) setTypeCounts(null); });
            return () => { cancelled = true; };
        }

        getSearchTypeCounts(query, { country, orientation }).then((counts) => {
            if (!cancelled) setTypeCounts(counts);
        });
        return () => { cancelled = true; };
    }, [query, country, orientation]);

    // Un changement de type de média ne doit jamais faire perdre la
    // recherche, le pays ou le tri en cours — seul `type` change.
    const typeHref = (basePath) => {
        const queryString = searchParams.toString();
        return queryString ? `${basePath}?${queryString}` : basePath;
    };

    const checkScroll = () => {
        const element = scrollRef.current;
        if (!element) return;
        const { scrollLeft, scrollWidth, clientWidth } = element;
        setShowLeftArrow(scrollLeft > 10);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    };

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        element.addEventListener("scroll", checkScroll);
        checkScroll();
        const timer = setTimeout(checkScroll, 300);
        return () => {
            element.removeEventListener("scroll", checkScroll);
            clearTimeout(timer);
        };
    }, [topics]);

    const scroll = (direction) => {
        scrollRef.current?.scrollBy({
            left: direction === "left" ? -400 : 400,
            behavior: "smooth",
        });
    };

    const mediaTypes = [
        { href: "/", label: "Photos", countKey: "photo" },
        { href: "/illustrations", label: "Illustrations", countKey: "illustration" },
        { href: "/videos", label: "Vidéos", countKey: "video" },
    ];

    // Le nav principal se réduit à 65px dès le premier défilement, y compris
    // sur mobile (voir Navbar.jsx, la rangée de recherche mobile se replie
    // sur `scrolled`) : un seul décalage suffit désormais, plus besoin de
    // distinguer mobile/bureau ici.
    const tabClass = (active) =>
        `flex items-center h-full whitespace-nowrap text-sm border-b-2 -mb-px transition-colors ${
            active
                ? "border-gray-900 dark:border-white text-gray-900 dark:text-white font-medium"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white"
        }`;

    return (
        <div className="sticky top-16 z-[45] bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-5 flex items-stretch gap-6 h-14">
                <nav aria-label="Type de média" className="hidden md:flex items-stretch gap-6 pr-6 shrink-0 relative after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:h-6 after:w-px after:bg-gray-200 dark:after:bg-zinc-700">
                    {mediaTypes.map((type) => (
                        <Link key={type.href} href={typeHref(type.href)} className={tabClass(pathname === type.href)}>
                            {type.label}
                            {typeCounts && (
                                <span className="ml-1.5 text-gray-400 dark:text-zinc-500 tabular-nums">{typeCounts[type.countKey]}</span>
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Pendant une recherche, les catégories n'ajoutent rien —
                    la requête et les filtres font déjà le travail de
                    tri, et les deux rangées ensemble surchargeaient la
                    barre. */}
                {!query && (
                <div className="relative flex-1 min-w-0 overflow-hidden">
                    {showLeftArrow && (
                        <div className="absolute left-0 inset-y-0 w-14 bg-linear-to-r from-white via-white dark:from-zinc-950 dark:via-zinc-950 to-transparent z-10 flex items-center">
                            <button
                                onClick={() => scroll("left")}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                                aria-label="Faire défiler vers la gauche"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <nav
                        ref={scrollRef}
                        aria-label="Thèmes"
                        className="flex items-stretch gap-6 h-full overflow-x-auto scrollbar-hide"
                    >
                        <Link href="/" className={tabClass(!activeTopic && pathname === "/")}>
                            À la une
                        </Link>

                        {topics.map((topic) => (
                            <Link
                                key={topic.slug}
                                href={`/themes/${topic.slug}`}
                                className={tabClass(activeTopic === topic.slug)}
                            >
                                {topic.name}
                            </Link>
                        ))}
                    </nav>

                    {showRightArrow && (
                        <div className="absolute right-0 inset-y-0 w-14 bg-linear-to-l from-white via-white dark:from-zinc-950 dark:via-zinc-950 to-transparent z-10 flex items-center justify-end">
                            <button
                                onClick={() => scroll("right")}
                                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
                                aria-label="Faire défiler vers la droite"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                )}

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {/* Tri et orientation n'ont d'intérêt qu'en train de
                        chercher — les afficher tout le temps surchargeait la
                        barre sur mobile pour un gain nul en navigation libre. */}
                    {query && (
                        <>
                            <OrientationFilter />
                            <SortControl />
                        </>
                    )}
                    <CountryFilter />
                </div>
            </div>
        </div>
    );
}
