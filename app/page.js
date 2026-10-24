// La page lit son adresse (?q=, ?pays=, ?tri=...) : elle est donc rendue à
// chaque visite, et ce `revalidate` ne la met pas en cache à lui seul. Ce
// sont ses lectures Supabase qui le sont (voir lib/supabase.js) :
// le rendu ne coûte plus que le temps de composer le HTML.
export const revalidate = 300;

import { Suspense } from "react";
import Link from "next/link";
import Hero from "./components/Hero";
import TopicBar from "./components/TopicBar";
import MasonryGrid from "./components/MasonryGrid";
import GridFallback from "./components/GridFallback";
import { pickShowcaseImage } from "./lib/auth-images";
import {
  getMedia, getHeroBackground, countMedia, getPlatformStats, getTopics, PAGE_SIZE,
} from "./lib/database";

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = params?.q;
  const orientation = params?.orientation || null;
  const country = params?.pays || null;
  const sort = params?.tri || "defaut";

  // Tout ce dont la page a besoin est chargé ici, en parallèle et côté
  // serveur (lectures mises en cache, voir lib/supabase.js). Auparavant, le
  // hero, les catégories et les thèmes lançaient chacun leurs requêtes depuis
  // le téléphone une fois la page affichée : une douzaine d'allers-retours
  // en 4G, et des blocs qui changeaient sous les yeux du visiteur.
  //
  // La première page de la grille est rendue par le serveur, avec les
  // filtres de l'adresse : sans elle, le HTML servi aux robots ne contenait
  // aucun lien vers une fiche image. Les recherches restent chargées côté
  // client, elles n'ont pas vocation à être indexées.
  const [initialItems, resultsCount, heroPhoto, stats, topics] = await Promise.all([
    query ? null : getMedia({ type: "photo", limit: PAGE_SIZE, country, orientation, sort }),
    query ? countMedia({ query, type: "photo", country, orientation }) : null,
    query ? null : getHeroBackground(),
    query ? null : getPlatformStats(),
    query ? [] : getTopics({ limit: 30 }),
  ]);

  // Une vraie photo du catalogue plutôt qu'un visuel de décor Unsplash : le
  // hero d'accueil doit montrer ce que la plateforme publie réellement, pas
  // une image d'emprunt créditée sous le nom de la marque.
  const heroBackground = query ? null : heroPhoto || pickShowcaseImage();

  // Tendances du hero : « Gabon » d'abord (la promesse du site), puis les
  // catégories les plus fournies du catalogue réel. Les mots-clés libres
  // sont écartés : saisis par chaque contributeur, ils ne sont pas relus.
  const trending = [
    "Gabon",
    ...topics
      .filter((topic) => topic.kind === "category" && topic.total_media > 0)
      .sort((a, b) => (b.total_media || 0) - (a.total_media || 0))
      .map((topic) => topic.name)
      .filter((name) => name.toLowerCase() !== "gabon"),
  ].slice(0, 6);

  // À la manière d'Unsplash, les photos suivent directement le hero : pas de
  // blocs intermédiaires à faire défiler avant d'atteindre ce que le
  // visiteur est venu chercher. Thèmes et collections restent à un clic,
  // dans la barre de thèmes et la navigation.
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      {!query && <Hero background={heroBackground} stats={stats} trending={trending} />}

      <Suspense fallback={<div className="h-14 border-b border-gray-200 dark:border-zinc-800" />}>
        <TopicBar />
      </Suspense>

      {query && (
        <div className="max-w-[1320px] mx-auto px-4 sm:px-5 pt-8 md:pt-12 pb-2">
          <h1 className="text-3xl md:text-[40px] leading-tight font-bold tracking-tight text-gray-900 dark:text-zinc-100 first-letter:uppercase">
            {query}
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-2">
            {resultsCount} image{resultsCount > 1 ? "s" : ""} libre{resultsCount > 1 ? "s" : ""} de
            droits de haute qualité.
          </p>
        </div>
      )}

      <Suspense fallback={<GridFallback />}>
        <MasonryGrid initialItems={initialItems} />
      </Suspense>

      <section className="border-t border-gray-200 dark:border-zinc-800 mt-16">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-5 py-16 md:py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">
              Vous photographiez ? Cette banque est la vôtre.
            </h2>
            <p className="mt-3 text-gray-500 dark:text-zinc-400">
              Publiez vos images, gardez vos droits, et faites voir votre travail
              bien au-delà d&apos;un fil d&apos;actualité. Retrait possible à tout moment.
            </p>
          </div>
          <Link href="/submit" className="btn btn-primary btn-lg self-start md:self-auto shrink-0">
            Publier une image
          </Link>
        </div>
      </section>
    </main>
  );
}
