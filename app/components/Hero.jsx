"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCount } from "../lib/media";
import { useDataSaver } from "../lib/data-saver";

// Repli si le catalogue ne renvoie encore aucun thème.
const DEFAULT_TRENDING = ["Gabon", "Nature", "Portrait", "Culture", "Libreville", "Marché"];

/**
 * `stats` et `trending` arrivent avec la page (voir app/page.js) : les
 * chercher après l'affichage changeait le texte du hero sous les yeux du
 * visiteur et coûtait une requête de plus depuis le téléphone.
 */
export default function Hero({ background, stats = null, trending = [] }) {
    const router = useRouter();
    const dataSaver = useDataSaver();
    const [term, setTerm] = useState("");
    const trendingTerms = trending.length > 0 ? trending.slice(0, 5) : DEFAULT_TRENDING.slice(0, 5);

    const submitSearch = (event) => {
        event.preventDefault();
        const value = term.trim();
        router.push(value ? `/?q=${encodeURIComponent(value)}` : "/");
    };

    const totalPhotos = stats?.total_photos || 0;
    const totalContributors = stats?.total_contributors || 0;

    return (
        <section className="relative w-full h-[340px] md:h-[560px] flex items-center text-white overflow-hidden bg-zinc-900">
            <div className="absolute inset-0">
                {/* Aperçu flou (quelques centaines d'octets, déjà dans le
                    HTML) visible tout de suite, sous la vraie image qui se
                    dessine par-dessus au fil du téléchargement. */}
                {background.blurDataURL && (
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                            backgroundImage: `url(${background.blurDataURL})`,
                            filter: "blur(12px)",
                            transform: "scale(1.05)",
                        }}
                    />
                )}
                {/* Sur téléphone (ou en économie de données), la vignette de
                    800 px suffit à un fond assombri sous du texte. */}
                <picture>
                    {!dataSaver && <source media="(min-width: 768px)" srcSet={background.url} />}
                    <img
                        src={background.thumbnailUrl || background.url}
                        alt=""
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                </picture>
                {/* Le fond change à chaque visite et peut être très clair :
                    le voile doit garder les petits textes lisibles dans le
                    pire cas, pas seulement sur une photo sombre. */}
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-black/50 to-transparent" />
            </div>

            <div className="relative z-10 w-full max-w-[880px] mx-auto px-5 md:px-8">
                <h1 className="text-[32px] leading-tight md:text-[46px] font-bold tracking-tight">
                    Images libres de droits de haute qualité
                </h1>
                <p className="mt-3 text-base md:text-lg text-white/90 max-w-xl">
                    {/* Les compteurs viennent de la base : on n'annonce un
                        volume que lorsqu'il existe vraiment. */}
                    {totalPhotos > 0 ? (
                        <>
                            {formatCount(totalPhotos)} image{totalPhotos > 1 ? "s" : ""} en haute
                            résolution, partagée{totalPhotos > 1 ? "s" : ""} par{" "}
                            {formatCount(totalContributors)} photographe
                            {totalContributors > 1 ? "s" : ""}.
                        </>
                    ) : (
                        <>Une sélection soignée, où l&apos;on trouve de belles images du continent.</>
                    )}
                </p>

                <form onSubmit={submitSearch} role="search" className="relative mt-8 hidden md:block">
                    <label htmlFor="hero-search" className="sr-only">Rechercher une image</label>
                    <button
                        type="submit"
                        aria-label="Rechercher"
                        className="absolute inset-y-0 left-0 w-12 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    <input
                        id="hero-search"
                        type="search"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Rechercher des images libres de droits"
                        className="w-full h-14 pl-12 pr-4 rounded-md bg-white text-base text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-white/60 transition-shadow"
                    />
                </form>

                <p className="mt-4 text-sm text-white/90">
                    <span className="mr-1">Tendances :</span>
                    {trendingTerms.map((tag, index) => (
                        <span key={tag}>
                            <Link
                                href={`/?q=${encodeURIComponent(tag.toLowerCase())}`}
                                className="text-white hover:underline underline-offset-2"
                            >
                                {tag.toLowerCase()}
                            </Link>
                            {index < trendingTerms.length - 1 && ", "}
                        </span>
                    ))}
                </p>
            </div>

            <div className="absolute bottom-5 inset-x-0 z-10 px-5 md:px-8 hidden md:flex items-center justify-between text-sm text-white/80">
                <p>
                    Photo de{" "}
                    {background.photographer_url ? (
                        <Link href={background.photographer_url} className="text-white/90 hover:text-white hover:underline underline-offset-2">
                            {background.photographer}
                        </Link>
                    ) : (
                        <span className="text-white/90">{background.photographer}</span>
                    )}
                </p>
                <Link href="/licence" className="hover:text-white hover:underline underline-offset-2">
                    Lire la Licence JEaLiFe
                </Link>
            </div>
        </section>
    );
}
