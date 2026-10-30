"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ThanksModal from "./ThanksModal";

export default function ClientLayout({ children }) {
    const pathname = usePathname();
    const [thanksPhoto, setThanksPhoto] = useState(null);

    const hiddenRoutes = [
        "/login",
        "/join",
        "/forgot-password",
        "/reset-password",
        "/auth/callback",
    ];
    // L'admin a sa propre coquille (app/admin/layout.js — sidebar desktop,
    // barre d'onglets mobile) : la Navbar publique n'a rien à y faire, elle
    // ferait doublon avec sa navigation et lui volerait la largeur réservée
    // par `md:pl-[64px]` ci-dessous.
    const shouldHideLayout = hiddenRoutes.includes(pathname) || pathname.startsWith("/admin");

    const footerRoutes = [
        "/about",
        "/press",
        "/help",
        "/licence",
        "/settings",
    ];
    const shouldShowFooter = !shouldHideLayout && footerRoutes.some(route => pathname.startsWith(route));

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    useEffect(() => {
        const handleShowThanks = (e) => {
            setThanksPhoto(e.detail);
        };
        window.addEventListener("show-thanks-modal", handleShowThanks);
        return () => window.removeEventListener("show-thanks-modal", handleShowThanks);
    }, []);

    return (
        <>
            {/* Sans <Suspense> : la Navbar ne lit plus `useSearchParams()`
                elle-même (voir SearchTermSync), elle est donc rendue côté
                serveur sur toutes les pages, statiques comprises. */}
            {!shouldHideLayout && <Navbar />}
            <div className={!shouldHideLayout ? "md:pl-[64px] transition-all duration-300 flex flex-col min-h-screen" : "flex flex-col min-h-screen"}>
                <div className="flex-1">
                    {children}
                </div>
                {shouldShowFooter && <Footer />}
            </div>
            {thanksPhoto && (
                <ThanksModal
                    photo={thanksPhoto}
                    onClose={() => setThanksPhoto(null)}
                />
            )}
        </>
    );
}
