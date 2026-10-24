"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import LikeButton from "./LikeButton";
import SaveToCollectionButton from "./SaveToCollectionButton";
import ImageLoader from "./ImageLoader";
import { CardAuthor } from "./PhotoCard";
import { locationLabel, mediaUrl } from "../lib/media";

/** Même structure que PhotoCard : actions au survol sur bureau, autour de l'image sur mobile. */
export default function VideoCard({ video, liked = false }) {
    const [loaded, setLoaded] = useState(false);

    if (!video) return null;

    const place = locationLabel(video);
    const poster = video.thumbnailUrl || video.url;
    const revealOnHover =
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100 transition-opacity duration-200";

    return (
        <figure className="group relative break-inside-avoid">
            <div className="md:hidden pb-3">
                <CardAuthor media={video} place={place} />
            </div>

            <div className="relative">
                <div className="relative overflow-hidden rounded-sm bg-gray-900">
                    <Link href={mediaUrl(video)} className="block" aria-label={video.alt || video.title || "Voir la vidéo"}>
                        <div className="relative w-full" style={video.width && video.height ? { aspectRatio: `${video.width} / ${video.height}` } : { aspectRatio: "16/9" }}>
                            {!loaded && !video.blurDataURL && <ImageLoader />}
                            <Image
                                src={poster}
                                alt={video.alt}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
                                unoptimized
                                className="object-cover"
                                onLoad={() => setLoaded(true)}
                                onError={() => setLoaded(true)}
                                onContextMenu={video.isPremium ? (e) => e.preventDefault() : undefined}
                                {...(video.blurDataURL
                                    ? { placeholder: "blur", blurDataURL: video.blurDataURL }
                                    : {})}
                            />

                            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/55 text-white text-xs font-medium pl-1.5 pr-2 py-1 rounded-md">
                                <Play className="w-3 h-3 fill-white" aria-hidden="true" />
                                {video.duration || "Vidéo"}
                            </span>
                        </div>
                    </Link>

                    <div
                        aria-hidden="true"
                        className={`hidden md:block absolute inset-0 pointer-events-none bg-linear-to-b from-black/20 via-transparent to-black/50 ${revealOnHover}`}
                    />
                </div>

                <div className={`hidden md:flex absolute top-4 right-4 gap-2 z-[11] ${revealOnHover}`}>
                    <LikeButton mediaId={video.id} initialLiked={liked} initialCount={video.likes} variant="overlay" />
                    <SaveToCollectionButton mediaId={video.id} />
                </div>

                <div className={`hidden md:flex absolute bottom-0 inset-x-0 p-4 z-[12] ${revealOnHover}`}>
                    <CardAuthor media={video} place={place} onImage />
                </div>
            </div>

            <div className="md:hidden flex items-center gap-2 pt-3">
                <LikeButton mediaId={video.id} initialLiked={liked} initialCount={video.likes} variant="outline" />
                <SaveToCollectionButton mediaId={video.id} variant="outline" menuAlign="left" />
            </div>
        </figure>
    );
}
