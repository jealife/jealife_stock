// Signature commune aux solutions de JEaLiFe Agency : petit badge blanc en bas à droite
// du pied de page, qui renvoie vers le site de l'agence. Même rendu sur chaque solution.
export default function CraftedBy({ className = "" }) {
  return (
    <a
      href="https://jealife.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conçu par JEaLiFe Agency"
      className={`inline-flex shrink-0 items-center gap-2.5 rounded-full bg-white py-2 pl-4 pr-3.5 shadow-sm ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      <span className="text-[12px] font-medium text-neutral-500">Conçu par</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/jealife-agency.svg" alt="" width="90" height="24" className="h-6 w-auto" />
    </a>
  );
}
