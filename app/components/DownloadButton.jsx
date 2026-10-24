"use client";

import { Download, Loader2, ChevronDown, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getSetting, getPremiumPricing, spendCreditsForDownload } from "../lib/database";
import { downloadOptionsFor, downloadMedia, mediaUrl, fetchPhotoAccess } from "../lib/media";
import { useDataSaver } from "../lib/data-saver";

/**
 * Téléchargement avec choix de format.
 *
 * Le menu listait « Petit / Moyen / Original » mais les trois options
 * récupéraient le fichier d'origine. Chaque taille est désormais réellement
 * produite avant l'enregistrement — et les options proposées dépendent du
 * type de média : une vidéo ne se redimensionne pas dans un navigateur.
 *
 * Contenu Premium (migration 0019) : la variante compacte (cartes de grille)
 * n'offre plus jamais le téléchargement gratuit direct — un média premium y
 * renvoie vers sa fiche, seul endroit qui affiche le prix et gère l'achat.
 * Sans ça, le petit bouton de téléchargement des grilles aurait continué à
 * distribuer gratuitement un contenu que son auteur a choisi de vendre.
 */
export default function DownloadButton({ media, variant = "compact", onDownloaded }) {
    if (media?.isPremium) {
        return variant === "primary"
            ? <PremiumDownload media={media} onDownloaded={onDownloaded} />
            : <PremiumCompactLink media={media} variant={variant} />;
    }
    return <FreeDownloadButton media={media} variant={variant} onDownloaded={onDownloaded} />;
}

const OUTLINE_BUTTON =
    "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-transparent text-sm font-medium text-gray-700 dark:text-zinc-300 hover:text-gray-900 hover:border-gray-900 dark:hover:text-white dark:hover:border-zinc-400 transition-colors disabled:opacity-60";

const PRIMARY_BUTTON =
    "h-9 bg-gray-900 text-white dark:bg-white dark:text-black hover:bg-black dark:hover:bg-gray-200 font-medium text-[13px] transition-colors flex items-center gap-2 disabled:opacity-70";

function PremiumCompactLink({ media, variant }) {
    return (
        <Link
            href={mediaUrl(media)}
            onClick={(event) => event.stopPropagation()}
            title="Contenu Premium : voir la fiche pour le débloquer"
            aria-label="Contenu Premium : voir la fiche pour le débloquer"
            className={variant === "outline" ? OUTLINE_BUTTON : "btn-overlay text-amber-600 hover:text-amber-700"}
        >
            <Lock className={`w-4 h-4 ${variant === "outline" ? "text-amber-600" : ""}`} />
            {variant === "outline" && <span>Premium</span>}
        </Link>
    );
}

/**
 * Bouton principal (fiche photo) pour un média Premium. Tant que
 * `payments_enabled` est faux (réglage admin, migration 0019), rien n'est
 * cliquable : juste le badge « Bientôt disponible » promis aux contributeurs
 * en attendant un fournisseur Mobile Money. Une fois activé, le clic dépense
 * les crédits avant de déclencher le téléchargement réel — jamais l'inverse.
 */
function PremiumDownload({ media, onDownloaded }) {
    const { user } = useAuth();
    const router = useRouter();
    // Le contributeur consulte aussi la fiche de son propre média : la
    // fonction SQL refuse à dessein qu'il s'achète lui-même (voir migration
    // 0019), donc l'achat ne doit même pas lui être proposé — juste un
    // téléchargement direct, comme pour un média gratuit.
    const isOwner = !!user && user.id === media.author?.id;
    const [settings, setSettings] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOwner) return;
        Promise.all([getSetting("payments_enabled"), getPremiumPricing()]).then(([enabled, rows]) => {
            setSettings({
                paymentsEnabled: enabled === "true",
                // Le contributeur peut avoir fixé son propre prix pour CE
                // média précis (voir migration 0022) — il prime toujours sur
                // le tarif par défaut du type.
                creditsCost: media.customCreditsCost || rows.find((r) => r.media_type === media.type)?.credits_cost || null,
            });
        });
    }, [media.type, media.customCreditsCost, isOwner]);

    // `media.url`/`media.originalUrl` sont redactés à la source pour un
    // média Premium (voir page.js) : ni le propriétaire ni l'acheteur ne
    // peuvent s'en servir tels quels. `/api/photo-access` est le seul
    // endroit qui accepte de rendre l'adresse réelle, une fois le droit
    // d'accès vérifié côté serveur.
    const downloadOwnMedia = async () => {
        setBusy(true);
        setError(null);
        try {
            const access = await fetchPhotoAccess(media.id);
            if (!access.originalUrl) throw new Error("Fichier indisponible.");
            const unlocked = { ...media, url: access.url || media.thumbnailUrl, originalUrl: access.originalUrl };
            await downloadMedia(unlocked, "original");
            window.dispatchEvent(new CustomEvent("show-thanks-modal", { detail: unlocked }));
            onDownloaded?.();
        } catch (err) {
            console.error("Download failed:", err);
            setError("Téléchargement impossible");
        } finally {
            setBusy(false);
        }
    };

    const purchase = async () => {
        if (!user) {
            router.push(`/login?redirect=${encodeURIComponent(mediaUrl(media))}`);
            return;
        }
        setBusy(true);
        setError(null);

        const result = await spendCreditsForDownload(media.id);
        if (!result.success) {
            setError(result.error);
            setBusy(false);
            return;
        }

        const access = await fetchPhotoAccess(media.id);
        if (!access.originalUrl) {
            setError("Achat enregistré, mais le fichier est momentanément indisponible.");
            setBusy(false);
            return;
        }

        const unlocked = { ...media, url: access.url || media.thumbnailUrl, originalUrl: access.originalUrl };
        await downloadMedia(unlocked, "original");
        window.dispatchEvent(new CustomEvent("show-thanks-modal", { detail: unlocked }));
        onDownloaded?.();
        setBusy(false);
    };

    if (isOwner) {
        return (
            <div className="flex flex-col items-end gap-1">
                <button
                    onClick={downloadOwnMedia}
                    disabled={busy}
                    className={`${PRIMARY_BUTTON} rounded-md px-3 sm:px-4`}
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="hidden sm:inline">Télécharger votre média</span>
                    <span className="sm:hidden">Télécharger</span>
                </button>
                {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="h-9 px-4 bg-gray-100 dark:bg-zinc-800 rounded-md flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400 dark:text-zinc-500" />
            </div>
        );
    }

    if (!settings.paymentsEnabled) {
        return (
            <div
                title="Le paiement en ligne n'est pas encore activé sur JEaLiFe Stock. Vous pourrez bientôt débloquer ce fichier avec des crédits, achetés via Mobile Money."
                className="h-9 px-3 sm:px-4 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900 rounded-md font-medium text-[13px] flex items-center gap-2 cursor-default"
            >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Premium · Bientôt disponible</span>
                <span className="sm:hidden">Bientôt</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end gap-1.5">
            <button
                onClick={purchase}
                disabled={busy}
                className={`${PRIMARY_BUTTON} rounded-md px-3 sm:px-4`}
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4 text-amber-400 dark:text-amber-600" />}
                {settings.creditsCost
                    ? `Télécharger (${settings.creditsCost} crédit${settings.creditsCost > 1 ? "s" : ""})`
                    : "Télécharger"}
            </button>
            {error && (
                <p className="text-[11px] text-red-600 dark:text-red-400 text-right max-w-56">
                    {error}{" "}
                    {error === "Crédits insuffisants." && (
                        <Link href="/credits" className="underline font-semibold">Acheter des crédits</Link>
                    )}
                </p>
            )}
        </div>
    );
}

function FreeDownloadButton({ media, variant = "compact", onDownloaded }) {
    const options = downloadOptionsFor(media);
    const isVideo = media?.type === "video";
    // En économie de données, le bouton principal livre la taille moyenne
    // (1920 px, quelques centaines de Ko) plutôt que l'original, qui peut
    // peser plus de 10 Mo. L'original reste dans le menu des tailles.
    const dataSaver = useDataSaver();
    const quickKey = !isVideo && dataSaver ? "medium" : "original";
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const run = async (sizeKey) => {
        setOpen(false);
        setBusy(true);
        setError(null);
        try {
            await downloadMedia(media, sizeKey);
            window.dispatchEvent(new CustomEvent("show-thanks-modal", { detail: media }));
            onDownloaded?.();
        } catch (err) {
            console.error("Download failed:", err);
            setError("Téléchargement impossible");
        } finally {
            setBusy(false);
        }
    };

    const menu = (
        <div className="absolute right-0 bottom-full mb-2 w-60 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <p className="px-4 pt-3 pb-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
                Choisir la taille
            </p>
            {options.map((option) => (
                <button
                    key={option.key}
                    onClick={() => run(option.key)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 text-left transition-colors group/item"
                >
                    <span>
                        <span className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{option.label}</span>
                        {option.hint && (
                            <span className="block text-xs text-gray-500 dark:text-zinc-400">{option.hint}</span>
                        )}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-600 group-hover/item:text-gray-900 dark:group-hover/item:text-zinc-100 transition-colors" />
                </button>
            ))}
        </div>
    );

    // Ligne d'actions des cartes sur mobile : un appui télécharge
    // directement, sans menu de tailles à viser du pouce.
    if (variant === "outline") {
        return (
            <div className="relative">
                <button onClick={() => run(quickKey)} disabled={busy} className={OUTLINE_BUTTON}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Télécharger
                </button>
                {error && <span className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-red-600 dark:text-red-400">{error}</span>}
            </div>
        );
    }

    if (variant === "primary") {
        return (
            <div className="relative flex items-center" ref={containerRef}>
                <button
                    onClick={() => run(quickKey)}
                    disabled={busy}
                    className={`${PRIMARY_BUTTON} rounded-l-md px-3 sm:px-4`}
                >
                    {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <span className="hidden sm:inline">
                                {isVideo
                                    ? "Télécharger la vidéo"
                                    : quickKey === "medium" ? "Télécharger (taille moyenne)" : "Télécharger gratuitement"}
                            </span>
                            <span className="sm:hidden">{quickKey === "medium" ? "Télécharger (moyen)" : "Télécharger"}</span>
                        </>
                    )}
                </button>
                <div className="h-9 w-px bg-white/20 dark:bg-black/15" />
                <button
                    onClick={() => setOpen(!open)}
                    className={`${PRIMARY_BUTTON} rounded-r-md px-2`}
                    aria-label="Choisir une taille de téléchargement"
                    aria-expanded={open}
                >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                    <div className="absolute right-0 top-11 w-64 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                        <div className="p-1.5">
                            {options.map((option) => (
                                <button
                                    key={option.key}
                                    onClick={() => run(option.key)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors group"
                                >
                                    <span className="text-left">
                                        <span className="block text-sm font-medium text-gray-900 dark:text-zinc-100">{option.label}</span>
                                        {option.hint && (
                                            <span className="block text-xs text-gray-500 dark:text-zinc-400">{option.hint}</span>
                                        )}
                                    </span>
                                    <Download className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                                </button>
                            ))}
                        </div>
                        <p className="px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 border-t border-gray-200 dark:border-zinc-800 text-xs text-gray-500 dark:text-zinc-400 leading-snug">
                            Gratuit, sous <Link href="/licence" className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-white">Licence JEaLiFe</Link>.
                        </p>
                    </div>
                )}

                {error && <span className="ml-3 text-xs text-red-600 dark:text-red-400">{error}</span>}
            </div>
        );
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen(!open)}
                disabled={busy}
                className={`btn-overlay ${open ? "bg-white text-gray-900" : ""}`}
                aria-label="Télécharger"
                aria-expanded={open}
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
            {open && menu}
            {error && (
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap bg-red-600 text-white text-[11px] font-medium px-2.5 py-1 rounded-md shadow-lg z-50">
                    {error}
                </span>
            )}
        </div>
    );
}
