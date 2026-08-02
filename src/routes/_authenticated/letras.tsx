import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, FileText, Drum, Megaphone } from "lucide-react";
import { useLyrics, useArrangements, useStreetSongs, type Lyric } from "@/lib/queries";
import { normalize, formatDuration, formatLongDuration } from "@/lib/format";
import { SortBar, type SortMode } from "@/components/SortBar";
import { LyricViewerModal } from "@/components/LyricViewerModal";

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
  const [kind, setKind] = useState<"arreglos" | "calle">("calle");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortMode>("alfabetico");
  const [activeSong, setActiveSong] = useState<{
    title: string;
    kind: "calle" | "arreglo";
    lyric: Lyric | null;
  } | null>(null);

  const lyrics = useLyrics();
  const arrangements = useArrangements();
  const streetSongs = useStreetSongs();

  // ─── Pestaña ARREGLOS ──────────────────────────────────────────────────────────

  const allTagsArreglos = useMemo(() => {
    const set = new Set<string>();
    for (const a of arrangements.data ?? []) for (const t of a.tags ?? []) set.add(t);
    return [...set].sort();
  }, [arrangements.data]);

  const listArreglos = useMemo(() => {
    let base = (arrangements.data ?? []).filter((a) => !tag || (a.tags ?? []).includes(tag));
    if (query.trim()) {
      const q = normalize(query.trim());
      base = base.filter(
        (a) =>
          normalize(a.title).includes(q) || (a.tags ?? []).some((t) => normalize(t).includes(q)),
      );
    }
    const copy = [...base];
    if (sort === "alfabetico") copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "duracion") copy.sort((a, b) => b.duration_seconds - a.duration_seconds);
    if (sort === "manual") copy.sort((a, b) => a.sort_order - b.sort_order);
    return copy;
  }, [arrangements.data, query, tag, sort]);

  // ─── Pestaña CALLE ─────────────────────────────────────────────────────────────

  const allTagsCalle = useMemo(() => {
    const set = new Set<string>();
    for (const s of streetSongs.data ?? []) for (const t of s.tags ?? []) set.add(t);
    return [...set].sort();
  }, [streetSongs.data]);

  const listCalle = useMemo(() => {
    let base = (streetSongs.data ?? []).filter((s) => !tag || (s.tags ?? []).includes(tag));
    if (query.trim()) {
      const q = normalize(query.trim());
      base = base.filter(
        (s) =>
          normalize(s.title).includes(q) || (s.tags ?? []).some((t) => normalize(t).includes(q)),
      );
    }
    const copy = [...base];
    if (sort === "alfabetico") copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "manual") copy.sort((a, b) => a.sort_order - b.sort_order);
    return copy;
  }, [streetSongs.data, query, tag, sort]);

  // ─── Helpers ────────────────────────────────────────────────────────────────────

  const allTags = kind === "arreglos" ? allTagsArreglos : allTagsCalle;

  function getLyricForArrangement(arrId: string, arrTitle: string): Lyric | null {
    if (!lyrics.data) return null;
    const byId = lyrics.data.find((l) => l.arrangement_id === arrId);
    if (byId) return byId;
    const norm = normalize(arrTitle);
    return (
      lyrics.data.find(
        (l) =>
          l.kind === "arreglo" &&
          (normalize(l.title) === norm ||
            l.title.toUpperCase().trim() === arrTitle.toUpperCase().trim()),
      ) ??
      lyrics.data.find((l) => normalize(l.title) === norm) ??
      null
    );
  }

  function getLyricForStreetSong(songId: string, songTitle: string): Lyric | null {
    if (!lyrics.data) return null;
    const byId = lyrics.data.find((l) => l.street_song_id === songId);
    if (byId) return byId;
    const norm = normalize(songTitle);
    return (
      lyrics.data.find(
        (l) =>
          l.kind === "calle" &&
          (normalize(l.title) === norm ||
            l.title.toUpperCase().trim() === songTitle.toUpperCase().trim()),
      ) ??
      lyrics.data.find((l) => normalize(l.title) === norm) ??
      null
    );
  }

  const totalArreglos = (arrangements.data ?? []).reduce((s, a) => s + a.duration_seconds, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="comic-sm rounded-lg bg-primary p-2.5 text-primary-foreground">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold leading-none">Letras</h1>
          <p className="text-xs font-bold text-muted-foreground">
            Consulta letras sincronizadas con Repertorio. Para editar ve a Repertorio.
          </p>
        </div>
      </div>

      {/* Pestañas Arreglos / Calle */}
      <div className="comic-sm flex overflow-hidden rounded-md bg-card p-1">
        <button
          type="button"
          onClick={() => {
            setKind("arreglos");
            setTag("");
            setSort("alfabetico");
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
            kind === "arreglos"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Drum className="h-4 w-4" /> Arreglos
        </button>
        <button
          type="button"
          onClick={() => {
            setKind("calle");
            setTag("");
            setSort("alfabetico");
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
            kind === "calle"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Megaphone className="h-4 w-4" /> Calle
        </button>
      </div>

      {/* Contador */}
      <p className="text-sm font-bold text-muted-foreground">
        {kind === "arreglos"
          ? `${arrangements.data?.length ?? 0} arreglos · ${formatLongDuration(totalArreglos)} en total`
          : `${streetSongs.data?.length ?? 0} canciones de calle`}
      </p>

      {/* SortBar */}
      <SortBar
        value={sort}
        onChange={setSort}
        options={
          kind === "arreglos" ? ["alfabetico", "duracion", "manual"] : ["alfabetico", "manual"]
        }
      />

      {/* Filtros por tag */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTag("")}
            className={`comic-sm rounded px-2.5 py-1 text-xs font-extrabold uppercase ${
              tag === "" ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            Todas (
            {kind === "arreglos"
              ? (arrangements.data?.length ?? 0)
              : (streetSongs.data?.length ?? 0)}
            )
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

      {/* Buscador */}
      <div className="comic-sm flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o etiqueta…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
      </div>

      {/* Lista de ARREGLOS */}
      {kind === "arreglos" && (
        <div className="space-y-2">
          {listArreglos.length === 0 && (
            <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
              No hay arreglos que coincidan con la búsqueda.
            </p>
          )}
          {listArreglos.map((a) => {
            const lyric = getLyricForArrangement(a.id, a.title);
            return (
              <div
                key={a.id}
                onClick={() => setActiveSong({ title: a.title, kind: "arreglo", lyric })}
                className={`comic rounded-xl bg-card p-4 transition-colors cursor-pointer hover:bg-primary/5 ${
                  !lyric ? "opacity-75" : ""
                }`}
                title={lyric ? "Ver letra" : "Sin letra registrada"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-extrabold leading-tight">{a.title}</p>
                    <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                      {formatDuration(a.duration_seconds)}
                      {lyric ? " · Con letra" : " · Sin letra"}
                    </p>
                    {!!a.tags?.length && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.tags.map((t) => (
                          <span
                            key={t}
                            className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {lyric && <FileText className="mt-1 h-5 w-5 shrink-0 text-primary/70" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de CALLE */}
      {kind === "calle" && (
        <div className="space-y-2">
          {listCalle.length === 0 && (
            <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
              No hay canciones que coincidan con la búsqueda.
            </p>
          )}
          {listCalle.map((s) => {
            const lyric = getLyricForStreetSong(s.id, s.title);
            return (
              <div
                key={s.id}
                onClick={() => setActiveSong({ title: s.title, kind: "calle", lyric })}
                className={`comic rounded-xl bg-card p-4 transition-colors cursor-pointer hover:bg-primary/5 ${
                  !lyric ? "opacity-75" : ""
                }`}
                title={lyric ? "Ver letra" : "Sin letra registrada"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-extrabold leading-tight">{s.title}</p>
                    <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                      {lyric ? "Con letra" : "Sin letra"}
                    </p>
                    {!!s.tags?.length && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {lyric && <FileText className="mt-1 h-5 w-5 shrink-0 text-primary/70" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de letra */}
      {activeSong && (
        <LyricViewerModal
          title={activeSong.title}
          kind={activeSong.kind}
          lyric={activeSong.lyric}
          onClose={() => setActiveSong(null)}
        />
      )}
    </div>
  );
}
