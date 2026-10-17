"use client";

import { useSyncExternalStore } from "react";
import { setDataSaverPreference, useDataSaver, useDataSaverPreference } from "../lib/data-saver";

const emptySubscribe = () => () => {};

const OPTIONS = [
    { value: "auto", label: "Auto" },
    { value: "on", label: "Activé" },
    { value: "off", label: "Désactivé" },
];

/**
 * Réglage « Économie de données » (voir lib/data-saver.js), même contrôle
 * segmenté que le thème. « Auto » suit l'économiseur de données du
 * navigateur et la qualité de la connexion.
 */
export default function DataSaverToggle({ className = "" }) {
    const preference = useDataSaverPreference();
    const active = useDataSaver();
    // Réglage lu dans le stockage de l'appareil : rien de sélectionné tant
    // que la page n'est pas hydratée, pour que le rendu serveur et le
    // premier rendu client soient identiques.
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <div className="inline-flex items-center gap-0.5 p-1 bg-gray-100 dark:bg-zinc-800 rounded-full self-start">
                {OPTIONS.map(({ value, label }) => {
                    const selected = mounted && preference === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setDataSaverPreference(value)}
                            aria-pressed={selected}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                selected
                                    ? "bg-white dark:bg-zinc-600 text-black dark:text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
            {mounted && preference === "auto" && (
                <span className="text-[11px] text-gray-400 dark:text-zinc-500">
                    {active ? "Connexion lente détectée : économie activée." : "Selon votre connexion."}
                </span>
            )}
        </div>
    );
}
