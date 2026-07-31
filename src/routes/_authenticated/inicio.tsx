import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, ListMusic, Megaphone, Drum, Users } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import aniversarioAsset from "@/assets/aniversario.png.asset.json";
import { useArrangements, useStreetSongs, useSetlists, useLyrics } from "@/lib/queries";

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
  const arrangements = useArrangements();
  const street = useStreetSongs();
  const setlists = useSetlists();
  const lyrics = useLyrics();

  const cards = [
    { to: "/letras", label: "Letras", icon: Music, count: lyrics.data?.length ?? 0 },
    { to: "/repertorio", label: "Repertorio", icon: ListMusic, count: setlists.data?.length ?? 0 },
    { to: "/calle", label: "Calle", icon: Megaphone, count: street.data?.length ?? 0 },
    { to: "/arreglos", label: "Arreglos", icon: Drum, count: arrangements.data?.length ?? 0 },
  ] as const;

  return (
    <div>
      <div className="comic mb-6 flex items-center gap-4 rounded-xl bg-card p-4">
        <img src={logoAsset.url} alt="Logo de La Bomba Show" className="h-20 w-auto shrink-0" />
        <div className="min-w-0">
          <h1 className="text-3xl leading-none">¡Hola, xaranguer@!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo el repertorio de la banda en un mismo sitio.
          </p>
        </div>
        <img
          src={aniversarioAsset.url}
          alt="Sello 10 aniversario"
          className="ml-auto hidden h-20 w-auto shrink-0 sm:block"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ to, label, icon: Icon, count }) => (
          <Link
            key={to}
            to={to}
            className="comic comic-press flex flex-col gap-2 rounded-xl bg-card p-4"
          >
            <Icon className="h-7 w-7 text-primary" />
            <span className="text-2xl leading-none">{label}</span>
            <span className="text-sm font-bold text-muted-foreground">{count} registros</span>
          </Link>
        ))}
      </div>

      <Link
        to="/miembros"
        className="comic comic-press mt-3 flex items-center gap-3 rounded-xl bg-accent p-4 text-accent-foreground"
      >
        <Users className="h-6 w-6" />
        <span className="text-xl">Miembros y permisos</span>
      </Link>
    </div>
  );
}
