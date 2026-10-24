export default function SkeletonCard({ index = 0 }) {
    // Hauteurs déterministes basées sur l'index pour éviter les erreurs d'hydratation (SSR)
    const heights = ["h-[300px]", "h-[440px]", "h-[350px]", "h-[480px]", "h-[400px]"];

    return (
        <div className={`relative break-inside-avoid w-full ${heights[index % heights.length]} rounded-sm bg-gray-100 dark:bg-zinc-800 overflow-hidden`}>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" />
        </div>
    );
}
