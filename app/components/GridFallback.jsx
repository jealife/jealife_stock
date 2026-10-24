import SkeletonCard from "./SkeletonCard";

const COLUMN_VISIBILITY = ["flex", "hidden sm:flex", "hidden lg:flex"];

/** Squelette de grille rendu côté serveur, mêmes colonnes que MasonryGrid (1, 2 puis 3). */
export default function GridFallback({ count = 12 }) {
    const grid = COLUMN_VISIBILITY.map(() => []);
    [...Array(count)].forEach((_, index) => grid[index % grid.length].push(index));

    return (
        <div className="max-w-[1320px] mx-auto px-4 sm:px-5 py-6">
            <div className="flex flex-row gap-6">
                {grid.map((column, columnIndex) => (
                    <div key={columnIndex} className={`flex-1 flex-col gap-6 ${COLUMN_VISIBILITY[columnIndex]}`}>
                        {column.map((index) => <SkeletonCard key={index} index={index} />)}
                    </div>
                ))}
            </div>
        </div>
    );
}
