"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { likeMedia, unlikeMedia } from "../lib/database";
import { formatCount } from "../lib/media";

/**
 * Bouton « J'aime » réellement branché.
 *
 * Les cœurs affichés sur les cartes et sur la page photo n'avaient aucun
 * gestionnaire de clic : `likeMedia()` et `unlikeMedia()` existaient dans la
 * couche données mais n'étaient appelées nulle part. Rien n'était donc jamais
 * enregistré, et le compteur restait figé.
 */
export default function LikeButton({
    mediaId,
    initialLiked = false,
    initialCount = 0,
    variant = "overlay",
    showCount = false,
    className = "",
}) {
    const { user } = useAuth();
    const router = useRouter();
    const [liked, setLiked] = useState(initialLiked);
    const [count, setCount] = useState(initialCount);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        setLiked(initialLiked);
    }, [initialLiked]);

    useEffect(() => {
        setCount(initialCount);
    }, [initialCount]);

    const toggle = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!user) {
            router.push(`/login?redirect=/photos/${mediaId}`);
            return;
        }
        if (pending) return;

        // Bascule optimiste : sur une connexion lente, attendre la réponse du
        // serveur donne l'impression que le bouton ne marche pas.
        const nextLiked = !liked;
        setLiked(nextLiked);
        setCount((value) => Math.max(0, value + (nextLiked ? 1 : -1)));
        setPending(true);

        const ok = nextLiked
            ? await likeMedia(mediaId, user.id)
            : await unlikeMedia(mediaId, user.id);

        if (!ok) {
            setLiked(!nextLiked);
            setCount((value) => Math.max(0, value + (nextLiked ? -1 : 1)));
        }
        setPending(false);
    };

    const styles = {
        overlay: `btn-overlay ${liked ? "text-red-500 hover:text-red-600" : ""}`,
        outline: `inline-flex items-center justify-center gap-2 h-9 px-2.5 rounded-md border text-sm font-medium transition-colors ${
            liked
                ? "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600"
                : "bg-white dark:bg-transparent border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-900 hover:border-gray-900 dark:hover:text-white dark:hover:border-zinc-400"
        }`,
    };

    return (
        <button
            onClick={toggle}
            disabled={pending}
            className={`${styles[variant] || styles.overlay} ${className}`}
            aria-pressed={liked}
            aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
            title={liked ? "Retirer des favoris" : "J'aime"}
        >
            {/* Classes écrites en toutes lettres : Tailwind ne détecte pas
                les noms de classe construits dynamiquement. */}
            <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
            {showCount && count > 0 && <span className="text-xs font-semibold tabular-nums">{formatCount(count)}</span>}
        </button>
    );
}
