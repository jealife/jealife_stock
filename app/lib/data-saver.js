"use client";

import { useSyncExternalStore } from "react";

/**
 * Mode « économie de données ».
 *
 * Au Gabon, l'essentiel des visites se fait sur mobile, avec des forfaits
 * vendus au mégaoctet. Ce mode réduit ce que le site télécharge sans rien
 * retirer du catalogue :
 *   · les grandes images (accueil, fiche photo) s'affichent depuis la
 *     vignette de 800 px au lieu de la version web de 2400 px, avec un
 *     bouton pour charger la haute définition à la demande ;
 *   · les vidéos ne démarrent plus toutes seules ;
 *   · le bouton principal de téléchargement propose la taille moyenne
 *     plutôt que l'original de plusieurs mégaoctets.
 *
 * Trois réglages : « auto » (par défaut) suit le navigateur (option
 * « Économiseur de données » de Chrome, ou connexion lente détectée),
 * « on » et « off » forcent le choix. Le réglage reste sur l'appareil.
 */

const STORAGE_KEY = "jealife-data-saver";
const CHANGE_EVENT = "jealife-data-saver-change";

export function getDataSaverPreference() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === "on" || stored === "off" ? stored : "auto";
    } catch {
        return "auto";
    }
}

export function setDataSaverPreference(value) {
    try {
        if (value === "auto") localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, value);
    } catch {
        // Stockage indisponible (navigation privée) : le choix vaut pour la page.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Lu une seule fois par session : `effectiveType` est une estimation que le
// navigateur révise sans cesse (4g, 3g, 4g…). La suivre en direct faisait
// basculer la fiche photo entre la vignette et la haute définition, et
// apparaître puis disparaître le bouton « Afficher en haute définition ».
let constrainedAtStart = null;

function connectionIsConstrained() {
    if (constrainedAtStart !== null) return constrainedAtStart;
    const connection = typeof navigator !== "undefined" ? navigator.connection : null;
    constrainedAtStart = !!connection && (!!connection.saveData || ["slow-2g", "2g", "3g"].includes(connection.effectiveType));
    return constrainedAtStart;
}

function isDataSaverOn() {
    const preference = getDataSaverPreference();
    if (preference === "on") return true;
    if (preference === "off") return false;
    return connectionIsConstrained();
}

function subscribe(callback) {
    window.addEventListener(CHANGE_EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
        window.removeEventListener(CHANGE_EVENT, callback);
        window.removeEventListener("storage", callback);
    };
}

/** `true` quand le site doit économiser les données. Toujours `false` au rendu serveur. */
export function useDataSaver() {
    return useSyncExternalStore(subscribe, isDataSaverOn, () => false);
}

/** Réglage choisi (« auto », « on », « off »), pour l'interface de réglage. */
export function useDataSaverPreference() {
    return useSyncExternalStore(subscribe, getDataSaverPreference, () => "auto");
}
