"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Clock } from "lucide-react";
import LikeButton from "./LikeButton";
import DownloadButton from "./DownloadButton";
import SaveToCollectionButton from "./SaveToCollectionButton";
import ImageLoader from "./ImageLoader";
import { locationLabel, mediaUrl } from "../lib/media";

/** Auteur de la carte : en blanc sur l'image au survol (bureau), en clair au-dessus sur mobile. */
export function CardAuthor({ media, place, onImage = false }) {
    return (
        <Link href={`/@${media.author.username}`} className="flex items-center gap-2.5 min-w-0 group/author">
            <Image
                src={media.author.avatar}
                alt=""
                width={32}
                height={32}
                unoptimized
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-black/5 dark:ring-white/10"
            />
            <span className="min-w-0 leading-tight">
                <span
                    className={`flex items-center gap-1 text-sm font-medium truncate ${
                        onImage
                            ? "text-white/90 group-hover/author:text-white"
                            : "text-gray-900 dark:text-zinc-100"
                    }`}
                >
                    <span className="truncate">{media.author.name}</span>
                    {media.author.isVerified && (
                        <BadgeCheck
                            className={`w-3.5 h-3.5 shrink-0 ${onImage ? "text-white" : "text-gray-500 dark:text-zinc-400"}`}
                            aria-label="Contributeur vérifié"
                        />
                    )}
                </span>
                {place && (
                    <span className={`block text-xs truncate ${onImage ? "text-white/75" : "text-gray-500 dark:text-zinc-400"}`}>
                        {place}
                    </span>
                )}
            </span>
        </Link>
    );
}

/**
 * Carte de grille façon Unsplash. Sur bureau, les actions n'apparaissent
 * qu'au survol, posées sur un léger dégradé. Sur mobile (pas de survol),
 * elles ne recouvrent jamais la photo : auteur au-dessus, actions en
 * dessous.
 *
 * Les boutons sont posés hors du cadre `overflow-hidden` de l'image : à
 * l'intérieur, les menus qu'ils ouvrent (collections, tailles) seraient
 * coupés par les bords de la carte.
 */
// `mobileActions={false}` : grille serrée sur mobile (deux colonnes, ex.
// images similaires) où l'auteur et la rangée de boutons n'ont pas la place.
// Le survol sur ordinateur reste inchangé.
export default function PhotoCard({ photo, liked = false, hideActions = false, priority = false, mobileActions = true }) {
    // Chaque carte garde son fond (aperçu flou, ou à défaut un skeleton)
    // tant que sa vignette n'est pas arrivée ; l'image n'est jamais masquée
    // en attendant le JavaScript (voir historique : 3G).
    const [loaded, setLoaded] = useState(false);

    if (!photo) return null;

    const place = locationLabel(photo);
    const hasDimensions = photo.width && photo.height;
    const isPending = photo.status === "pending";
    const showActions = !hideActions && !isPending;

    // Visible au survol, au clavier, et tant qu'un menu ouvert depuis la
    // carte est affiché (sinon il disparaîtrait avec le curseur).
    const revealOnHover =
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity duration-200";

    return (
        <figure className="group relative break-inside-avoid">
            {showActions && mobileActions && (
                <div className="md:hidden pb-3">
                    <CardAuthor media={photo} place={place} />
                </div>
            )}

            <div className="relative">
                <div className="relative overflow-hidden rounded-sm bg-gray-100 dark:bg-zinc-800">
                    <Link href={mediaUrl(photo)} className="block cursor-zoom-in" aria-label={photo.alt || photo.title || "Voir l'image"}>
                        {hasDimensions ? (
                            <div className="relative w-full" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
                                {!loaded && !photo.blurDataURL && <ImageLoader />}
                                <Image
                                    src={photo.thumbnailUrl}
                                    alt={photo.alt}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                                    priority={priority}
                                    unoptimized
                                    onLoad={() => setLoaded(true)}
                                    onError={() => setLoaded(true)}
                                    onContextMenu={photo.isPremium ? (e) => e.preventDefault() : undefined}
                                    {...(photo.blurDataURL
                                        ? { placeholder: "blur", blurDataURL: photo.blurDataURL }
                                        : {})}
                                />
                            </div>
                        ) : (
                            <div className="relative w-full min-h-[220px]">
                                {!loaded && <ImageLoader />}
                                <Image
                                    src={photo.thumbnailUrl}
                                    alt={photo.alt}
                                    width={0}
                                    height={0}
                                    sizes="100vw"
                                    className="relative w-full h-auto block object-cover"
                                    loading="lazy"
                                    unoptimized
                                    onLoad={() => setLoaded(true)}
                                    onError={() => setLoaded(true)}
                                    onContextMenu={photo.isPremium ? (e) => e.preventDefault() : undefined}
                                />
                            </div>
                        )}
                    </Link>

                    {showActions && (
                        <div
                            aria-hidden="true"
                            className={`hidden md:block absolute inset-0 pointer-events-none bg-linear-to-b from-black/20 via-transparent to-black/50 ${revealOnHover}`}
                        />
                    )}

                    {/* Badge « En cours d'analyse » : visible uniquement par le
                        contributeur sur son propre profil, ces photos n'étant
                        jamais requêtées ailleurs. */}
                    {isPending && (
                        <div className="absolute inset-0 pointer-events-none bg-black/40">
                            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded-md">
                                <Clock className="w-3 h-3 shrink-0" />
                                En cours d&apos;analyse
                            </span>
                        </div>
                    )}
                </div>

                {showActions && (
                    <>
                        <div className={`hidden md:flex absolute top-4 right-4 gap-2 z-[11] ${revealOnHover}`}>
                            <LikeButton mediaId={photo.id} initialLiked={liked} initialCount={photo.likes} variant="overlay" />
                            <SaveToCollectionButton mediaId={photo.id} />
                        </div>

                        <div className={`hidden md:flex absolute bottom-0 inset-x-0 p-4 items-end justify-between gap-3 z-[12] ${revealOnHover}`}>
                            <CardAuthor media={photo} place={place} onImage />
                            <DownloadButton media={photo} />
                        </div>
                    </>
                )}
            </div>

            {showActions && mobileActions && (
                <div className="md:hidden flex items-center justify-between gap-2 pt-3">
                    <div className="flex items-center gap-2">
                        <LikeButton mediaId={photo.id} initialLiked={liked} initialCount={photo.likes} variant="outline" />
                        <SaveToCollectionButton mediaId={photo.id} variant="outline" menuAlign="left" />
                    </div>
                    <DownloadButton media={photo} variant="outline" />
                </div>
            )}
        </figure>
    );
}
