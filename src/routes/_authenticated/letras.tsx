import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Pencil, X } from "lucide-react";
import { useLyrics, type Lyric, type Scope } from "@/lib/queries";
import { normalize } from "@/lib/format";
import { useIsAdmin } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/letras")({
  head: () => ({
    meta: [
      { title: "Letras — La Bomba Show" },
      {
        name: "description",
        content: "Buscador de letras de calle y de arreglos de La Bomba Show Xaranga.",
      },
      { property: "og:title", content: "Letras — La Bomba Show" },
      {
        property: "og:description",
        content: "Buscador de letras de calle y de arreglos de La Bomba Show Xaranga.",
      },
    ],
  }),
  component: Letras,
});

function Letras() {
  const [kind, setKind] = useState<Scope>("calle");
  const [query, setQuery] = useState("");
  const [activeLyric, setActiveLyric] = useState<Lyric | null>(null);
  const lyrics = useLyrics();

  const list = useMemo(() => {
    const q = normalize(query.trim());
    return (lyrics.data ?? [])
      .filter((l) => l.kind === kind)
      .filter(
        (l) => !q || normalize(l.title).includes(q) || normalize(l.plain_text).includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [lyrics.data, kind, query]);

  return (
    <div>
      <h1 className="mb-4 text-4xl leading-none">Letras</h1>

      <div className="comic-sm mb-3 flex overflow-hidden rounded-md">
        {(
          [
            ["calle", "Calle"],
            ["arreglo", "Arreglos"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`flex-1 px-3 py-2 text-sm font-extrabold uppercase ${
              kind === value ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="comic-sm mb-3 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o por texto de la letra…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
      </div>

      <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
        Las letras se crean y editan desde Repertorio.
      </p>

      {list.length === 0 && (
        <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
          No hay letras que coincidan con la búsqueda.
        </p>
      )}

      <div className="space-y-2">
        {list.map((l) => (
          <div key={l.id} className="comic rounded-xl bg-card p-4">
            <button
              type="button"
              onClick={() => setActiveLyric(l)}
              className="w-full text-left text-xl font-bold leading-tight hover:text-primary transition-colors"
            >
              {l.title}
            </button>
          </div>
        ))}
      </div>

      {activeLyric && (
        <LyricViewerModal lyric={activeLyric} onClose={() => setActiveLyric(null)} />
      )}
    </div>
  );
}

function LyricViewerModal({ lyric, onClose }: { lyric: Lyric; onClose: () => void }) {
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const handleModify = () => {
    const tab = lyric.kind === "calle" ? "calle" : "arreglos";
    const editLyricId = lyric.kind === "calle" ? lyric.street_song_id : lyric.arrangement_id;

    onClose();
    if (editLyricId) {
      navigate({
        to: "/repertorio",
        search: { tab, editLyricId },
      });
    } else {
      navigate({
        to: "/repertorio",
        search: { tab },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="comic flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight text-primary">{lyric.title}</h2>
            <span className="mt-1 inline-block text-xs font-bold uppercase text-muted-foreground">
              {lyric.kind === "calle" ? "Canción de calle" : "Arreglo"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="comic-sm rounded p-1 hover:bg-muted"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto py-2">
          <div
            className="lyrics-body text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: lyric.content }}
          />
        </div>

        {isAdmin && (
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={handleModify}
              className="comic comic-press flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 font-extrabold uppercase text-primary-foreground"
            >
              <Pencil className="h-4 w-4" /> Modificar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
