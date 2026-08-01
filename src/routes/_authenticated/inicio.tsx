import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Clock, ListMusic, Library, FolderOpen, Camera, ChevronDown } from "lucide-react";
const ANIVERSARIO_SRC = "/logo-x-final-3.png";
import { useArrangements, useStreetSongs, useSetlists, useLyrics } from "@/lib/queries";
import { GlobalSearch } from "@/components/GlobalSearch";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio — La Bomba Show" },
      {
        name: "description",
        content: "Panel de la xaranga: letras, repertorio, setlists y contadores.",
      },
      { property: "og:title", content: "Inicio — La Bomba Show" },
      {
        property: "og:description",
        content: "Panel de la xaranga: letras, repertorio, setlists y contadores.",
      },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const [linksOpen, setLinksOpen] = useState(false);
  const arrangements = useArrangements();
  const street = useStreetSongs();
  const setlists = useSetlists();
  const lyrics = useLyrics();

  const totalContadores = (street.data?.length ?? 0) + (arrangements.data?.length ?? 0);

  const cards = [
    {
      to: "/letras",
      label: "Letras",
      icon: FileText,
      count: `${lyrics.data?.length ?? 0} registros`,
    },
    { to: "/contadores", label: "Contadores", icon: Clock, count: `${totalContadores} registros` },
    {
      to: "/setlists",
      label: "Setlists",
      icon: ListMusic,
      count: `${setlists.data?.length ?? 0} registros`,
    },
    {
      to: "/repertorio",
      label: "Repertorio",
      icon: Library,
      count: `${arrangements.data?.length ?? 0} arreglos`,
    },
  ] as const;

  return (
    <div>
      <div className="comic mb-6 flex items-center gap-4 rounded-xl bg-card p-4">
        <img src={ANIVERSARIO_SRC} alt="Sello 10 aniversario" className="h-20 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl leading-none">¡Hola, xaranguer@!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bienvenid@!</p>
        </div>
      </div>

      <GlobalSearch />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ to, label, icon: Icon, count }) => (
          <Link
            key={to}
            to={to}
            className="comic comic-press flex flex-col gap-2 rounded-xl bg-card p-4"
          >
            <Icon className="h-7 w-7 text-primary" />
            <span className="text-2xl leading-none">{label}</span>
            <span className="text-sm font-bold text-muted-foreground">{count}</span>
          </Link>
        ))}
      </div>

      {/* Accesos del grupo (desplegable) */}
      <div className="comic mt-6 overflow-hidden rounded-xl bg-card">
        <button
          type="button"
          onClick={() => setLinksOpen((v) => !v)}
          aria-expanded={linksOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-sm font-extrabold uppercase text-muted-foreground">
            Accesos del grupo
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              linksOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {linksOpen && (
          <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
            <a
              href="https://drive.google.com/drive/folders/1SJs1eIj7suxJL_eD9W0_m5rCBdva5jUi?usp=share_link"
              target="_blank"
              rel="noopener noreferrer"
              className="comic comic-press flex items-center gap-2.5 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground"
            >
              <FolderOpen className="h-5 w-5 shrink-0" />
              <span className="text-sm font-extrabold uppercase">Google Drive</span>
            </a>
            <a
              href="https://www.instagram.com/showlabomba?igsh=MTIweG1tM2luN3Jjbw=="
              target="_blank"
              rel="noopener noreferrer"
              className="comic comic-press flex items-center gap-2.5 rounded-lg bg-secondary px-4 py-3 text-secondary-foreground"
            >
              <Camera className="h-5 w-5 shrink-0" />
              <span className="text-sm font-extrabold uppercase">instagram</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
