import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Pencil, X } from "lucide-react";
import { useLyrics, useArrangements, useStreetSongs, type Lyric, type Scope } from "@/lib/queries";
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
  const [tag, setTag] = useState("");
  const [activeLyric, setActiveLyric] = useState<Lyric | null>(null);

  const lyrics = useLyrics();
  const arrangements = useArrangements();
  const streetSongs = useStreetSongs();

  // Mapear cada letra con sus etiquetas según la canción o arreglo correspondiente
  const lyricsWithTags = useMemo(() => {
    const arrMap = new Map((arrangements.data ?? []).map((a) => [a.id, a.tags ?? []]));
    const streetMap = new Map((streetSongs.data ?? []).map((s) => [s.id, s.tags ?? []]));
    const streetTitleMap = new Map((streetSongs.data ?? []).map((s) => [s.title.toUpperCase().trim(), s.tags ?? []]));

    return (lyrics.data ?? []).map((l) => {
      let lTags: string[] = [];
      if (l.kind === "arreglo" && l.arrangement_id) {
        lTags = arrMap.get(l.arrangement_id) ?? [];
      } else if (l.kind === "calle") {
        if (l.street_song_id) {
          lTags = streetMap.get(l.street_song_id) ?? [];
        } else {
          lTags = streetTitleMap.get(l.title.toUpperCase().trim()) ?? [];
        }
      }
      return { ...l, tags: lTags };
    });
  }, [lyrics.data, arrangements.data, streetSongs.data]);

  // Lista de todas las etiquetas disponibles para la pestaña actual (calle o arreglo)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    if (kind === "arreglo") {
      for (const a of arrangements.data ?? []) for (const t of a.tags ?? []) set.add(t);
    } else {
      for (const s of streetSongs.data ?? []) for (const t of s.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [kind, arrangements.data, streetSongs.data]);

  // Filtrar la lista de letras por tipo, búsqueda y etiqueta seleccionada
  const list = useMemo(() => {
    const q = normalize(query.trim());
    return lyricsWithTags
      .filter((l) => l.kind === kind)
      .filter((l) => !tag || (l.tags ?? []).includes(tag))
      .filter(
        (l) =>
          !q ||
          normalize(l.title).includes(q) ||
          normalize(l.plain_text).includes(q) ||
          (l.tags ?? []).some((t) => normalize(t).includes(q))
      )
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [lyricsWithTags, kind, query, tag]);

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
            onClick={() => {
              setKind(value);
              setTag("");
            }}
            className={`flex-1 px-3 py-2 text-sm font-extrabold uppercase ${
              kind === value ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTag("")}
            className={`comic-sm rounded px-2.5 py-1 text-xs font-extrabold uppercase ${
              tag === "" ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            Todas ({lyricsWithTags.filter((l) => l.kind === kind).length})
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t === tag ? "" : t)}
              className={`comic-sm rounded px-2.5 py-1 text-xs font-extrabold uppercase ${
                tag === t ? "bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="comic-sm mb-3 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, texto o etiqueta…"
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
              className="w-full text-left font-bold leading-tight hover:text-primary transition-colors"
            >
              <span className="text-xl block">{l.title}</span>
              {!!l.tags?.length && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {l.tags.map((t) => (
                    <span
                      key={t}
                      className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
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
