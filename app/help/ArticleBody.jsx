import Link from "next/link";

/** `[libellé](/adresse)` dans un texte d'article devient un lien interne. */
function RichText({ text }) {
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
        const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (!match) return part;
        return (
            <Link key={index} href={match[2]} className="text-gray-900 dark:text-white underline underline-offset-2 hover:no-underline">
                {match[1]}
            </Link>
        );
    });
}

export default function ArticleBody({ blocks }) {
    return (
        <div className="space-y-5 text-[17px] leading-relaxed text-gray-700 dark:text-zinc-300">
            {blocks.map((block, index) => {
                switch (block.type) {
                    case "h2":
                        return (
                            <h2 key={index} className="pt-4 text-xl font-semibold text-gray-900 dark:text-zinc-100">
                                {block.text}
                            </h2>
                        );
                    case "ul":
                        return (
                            <ul key={index} className="list-disc pl-6 space-y-2 marker:text-gray-400">
                                {block.items.map((item) => <li key={item}><RichText text={item} /></li>)}
                            </ul>
                        );
                    case "steps":
                        return (
                            <ol key={index} className="list-decimal pl-6 space-y-2 marker:font-semibold marker:text-gray-900 dark:marker:text-white">
                                {block.items.map((item) => <li key={item} className="pl-1"><RichText text={item} /></li>)}
                            </ol>
                        );
                    case "note":
                        return (
                            <p key={index} className="border-l-2 border-gray-900 dark:border-white bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-[15px] text-gray-700 dark:text-zinc-300">
                                <RichText text={block.text} />
                            </p>
                        );
                    case "quote":
                        return (
                            <p key={index} className="font-mono text-sm bg-gray-100 dark:bg-zinc-800 rounded-md px-4 py-3 text-gray-900 dark:text-zinc-100">
                                {block.text}
                            </p>
                        );
                    default:
                        return <p key={index}><RichText text={block.text} /></p>;
                }
            })}
        </div>
    );
}
