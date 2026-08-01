import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Clock, ListMusic, Library, FolderOpen, Camera, Link2 } from "lucide-react";
const ANIVERSARIO_SRC = "/logo-x-final-3.png";
import { useArrangements, useStreetSongs, useSetlists, useLyrics } from "@/lib/queries";
import { GlobalSearch } from "@/components/GlobalSearch";

const DRIVE_URL =
  "https://drive.google.com/drive/folders/1SJs1eIj7suxJL_eD9W0_m5rCBdva5jUi?usp=share_link";
const INSTAGRAM_URL = "https://www.instagram.com/showlabomba?igsh=MTIweG1tM2luN3Jjbw==";

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

  useEffect(() => {
    if (!linksOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLinksOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linksOpen]);

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

      {/* Accesos del grupo (desplegable, solo iconos) */}
      <div className="mt-20 flex justify-center">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLinksOpen((v) => !v)}
            aria-label="Enlaces del grupo"
            aria-expanded={linksOpen}
            className="comic-sm comic-press flex items-center justify-center rounded-lg bg-accent p-2 text-accent-foreground"
          >
            <Link2 className="h-5 w-5 shrink-0" />
          </button>
          {linksOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setLinksOpen(false)} />
              <div className="comic absolute left-1/2 top-full z-10 mt-2 flex -translate-x-1/2 gap-1.5 rounded-lg border-2 border-ink bg-card p-1.5 shadow-2xl">
                <a
                  href={DRIVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Google Drive"
                  title="Google Drive"
                  onClick={() => setLinksOpen(false)}
                  className="comic-sm comic-press flex items-center justify-center rounded-md bg-secondary p-2 text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <FolderOpen className="h-5 w-5" />
                </a>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram"
                  onClick={() => setLinksOpen(false)}
                  className="comic-sm comic-press flex items-center justify-center rounded-md bg-secondary p-2 text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  <Camera className="h-5 w-5" />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
