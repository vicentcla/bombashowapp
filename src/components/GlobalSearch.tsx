import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, ListMusic, Megaphone, Library, Music2 } from "lucide-react";
import { useArrangements, useStreetSongs, useSetlists, useLyrics, type Lyric } from "@/lib/queries";
import { normalize, formatDuration } from "@/lib/format";
import { LyricViewerModal } from "@/components/LyricViewerModal";

type ResultItem = {
  key: string;
  title: string;
  subtitle: string;
  snippet?: string;
  onClick: () => void;
};

const MAX_PER_GROUP = 6;

export function GlobalSearch() {
  const navigate = useNavigate();
  const arrangements = useArrangements();
  const street = useStreetSongs();
  const setlists = useSetlists();
  const lyrics = useLyrics();

  const [query, setQuery] = useState("");
  const [activeSong, setActiveSong] = useState<{
    title: string;
    kind: "calle" | "arreglo";
    lyric: Lyric | null;
  } | null>(null);
  const q = normalize(query.trim());

  const lyricsByArrangement = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lyrics.data ?? []) {
      if (l.arrangement_id) map.set(l.arrangement_id, l.plain_text);
    }
    return map;
  }, [lyrics.data]);

  const lyricsByStreet = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lyrics.data ?? []) {
      if (l.street_song_id) map.set(l.street_song_id, l.plain_text);
    }
    return map;
  }, [lyrics.data]);

  const lyricByArrangement = useMemo(() => {
    const map = new Map<string, Lyric>();
    for (const l of lyrics.data ?? []) {
      if (l.arrangement_id) map.set(l.arrangement_id, l);
    }
    return map;
  }, [lyrics.data]);

  const lyricByStreet = useMemo(() => {
    const map = new Map<string, Lyric>();
    for (const l of lyrics.data ?? []) {
      if (l.street_song_id) map.set(l.street_song_id, l);
    }
    return map;
  }, [lyrics.data]);

  const snippetFor = (text: string | undefined, max = 90): string | undefined => {
    if (!text || !q) return undefined;
    const hay = normalize(text);
    const idx = hay.indexOf(q);
    if (idx === -1) return undefined;
    const start = Math.max(0, idx - 30);
    const raw = text.slice(start, start + max);
    return `${start > 0 ? "…" : ""}${raw}${start + max < text.length ? "…" : ""}`;
  };

  const results = useMemo(() => {
    if (!q) return null;
    const matches = (title: string, tags: string[] | undefined, text?: string) =>
      normalize(title).includes(q) ||
      (tags ?? []).some((t) => normalize(t).includes(q)) ||
      (text ? normalize(text).includes(q) : false);

    const arrangementResults: ResultItem[] = (arrangements.data ?? [])
      .filter((a) => matches(a.title, a.tags, lyricsByArrangement.get(a.id)))
      .slice(0, MAX_PER_GROUP)
      .map((a) => {
        const snip = snippetFor(lyricsByArrangement.get(a.id));
        return {
          key: `a_${a.id}`,
          title: a.title,
          subtitle: `${formatDuration(a.duration_seconds)}${
            a.tags.length ? ` · ${a.tags.slice(0, 3).join(", ")}` : ""
          }`,
          ...(snip ? { snippet: snip } : {}),
          onClick: () =>
            setActiveSong({
              title: a.title,
              kind: "arreglo",
              lyric: lyricByArrangement.get(a.id) ?? null,
            }),
        };
      });

    const streetResults: ResultItem[] = (street.data ?? [])
      .filter((s) => matches(s.title, s.tags, lyricsByStreet.get(s.id)))
      .slice(0, MAX_PER_GROUP)
      .map((s) => {
        const snip = snippetFor(lyricsByStreet.get(s.id));
        return {
          key: `s_${s.id}`,
          title: s.title,
          subtitle: s.tags?.length ? s.tags.slice(0, 3).join(", ") : "Canción de calle",
          ...(snip ? { snippet: snip } : {}),
          onClick: () =>
            setActiveSong({
              title: s.title,
              kind: "calle",
              lyric: lyricByStreet.get(s.id) ?? null,
            }),
        };
      });

    const setlistResults: ResultItem[] = (setlists.data ?? [])
      .filter((sl) => normalize(sl.name).includes(q))
      .slice(0, MAX_PER_GROUP)
      .map((sl) => ({
        key: `sl_${sl.id}`,
        title: sl.name,
        subtitle: sl.event_date
          ? new Date(sl.event_date).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Setlist",
        onClick: () => navigate({ to: "/setlists", search: { open: sl.id } }),
      }));

    return { arrangementResults, streetResults, setlistResults };
  }, [
    q,
    arrangements.data,
    street.data,
    setlists.data,
    lyricsByArrangement,
    lyricsByStreet,
    lyricByArrangement,
    lyricByStreet,
    navigate,
  ]);

  const total =
    results === null
      ? 0
      : results.arrangementResults.length +
        results.streetResults.length +
        results.setlistResults.length;

  const renderGroup = (
    label: string,
    icon: React.ReactNode,
    items: ResultItem[],
    emptyLabel: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </p>
        <div className="overflow-hidden rounded-lg border bg-background">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className="flex w-full items-start justify-between gap-3 border-b border-ink/5 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-primary/5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{item.title}</p>
                <p className="truncate text-[11px] font-bold text-muted-foreground">
                  {item.subtitle}
                </p>
                {item.snippet && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground italic">
                    {item.snippet}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="comic rounded-xl bg-card p-4">
        <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 border border-ink/10 focus-within:border-primary">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar canciones, setlists, letras…"
            className="w-full bg-transparent text-sm font-bold outline-none"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {results && (
          <div className="mt-3 space-y-4">
            {total === 0 ? (
              <p className="py-6 text-center text-sm font-bold text-muted-foreground">
                Sin resultados para «{query.trim()}»
              </p>
            ) : (
              <>
                {renderGroup(
                  "Canciones de calle",
                  <Megaphone className="h-3.5 w-3.5 text-primary" />,
                  results.streetResults,
                  "",
                )}
                {renderGroup(
                  "Arreglos",
                  <Library className="h-3.5 w-3.5 text-primary" />,
                  results.arrangementResults,
                  "",
                )}
                {renderGroup(
                  "Setlists",
                  <ListMusic className="h-3.5 w-3.5 text-primary" />,
                  results.setlistResults,
                  "",
                )}
                {results.arrangementResults.length >= MAX_PER_GROUP ||
                results.streetResults.length >= MAX_PER_GROUP ||
                results.setlistResults.length >= MAX_PER_GROUP ? (
                  <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                    <Music2 className="h-3 w-3" />
                    Hay más resultados; usa la búsqueda de cada sección para afinar.
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}

        {activeSong && (
          <LyricViewerModal
            title={activeSong.title}
            kind={activeSong.kind}
            lyric={activeSong.lyric}
            onClose={() => setActiveSong(null)}
          />
        )}
      </div>
    </>
  );
}
