import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, Pencil, FileText, Drum, Megaphone, Search, FileSpreadsheet, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LyricDialog } from "@/components/LyricDialog";
import { ImportExcelDialog } from "@/components/ImportExcelDialog";
import { ImportCalleDialog } from "@/components/ImportCalleDialog";
import { SortBar, type SortMode } from "@/components/SortBar";
import { SortableList, SortableItem } from "@/components/SortableList";
import {
  useArrangements,
  useStreetSongs,
  useLyrics,
  useInvalidate,
  useReorder,
  type Arrangement,
  type StreetSong,
} from "@/lib/queries";
import { formatDuration, formatLongDuration, normalize } from "@/lib/format";
import { TagInput } from "@/components/TagInput";

export const Route = createFileRoute("/_authenticated/repertorio")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search['tab'] === "calle" ? "calle" : ("arreglos" as "arreglos" | "calle"),
    editLyricId: typeof search['editLyricId'] === "string" ? search['editLyricId'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Repertorio — La Bomba Show" },
      {
        name: "description",
        content: "Catálogo de arreglos y canciones de calle con duración, etiquetas y letras.",
      },
      { property: "og:title", content: "Repertorio — La Bomba Show" },
      {
        property: "og:description",
        content: "Catálogo de arreglos y canciones de calle con duración, etiquetas y letras.",
      },
    ],
  }),
  component: Repertorio,
});

function Repertorio() {
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"arreglos" | "calle">(
    search['tab'] === "calle" ? "calle" : "arreglos"
  );

  const handleTabChange = (newTab: "arreglos" | "calle") => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      url.searchParams.delete("editLyricId");
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-4xl leading-none">Repertorio</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Aquí se construye todo: arreglos, canciones de calle, duraciones, etiquetas y letras.
      </p>

      <div className="comic-sm mb-4 flex overflow-hidden rounded-md bg-card p-1">
        <button
          type="button"
          onClick={() => handleTabChange("arreglos")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
            activeTab === "arreglos"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Drum className="h-4 w-4" />
          Arreglos
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("calle")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
            activeTab === "calle"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Megaphone className="h-4 w-4" />
          Calle
        </button>
      </div>

      {activeTab === "arreglos" ? (
        <RepertorioArreglos initialEditLyricId={search['editLyricId']} />
      ) : (
        <RepertorioCalle initialEditLyricId={search['editLyricId']} />
      )}
    </div>
  );
}

function RepertorioArreglos({ initialEditLyricId }: { initialEditLyricId?: string }) {
  const arrangements = useArrangements();
  const lyrics = useLyrics();
  const invalidate = useInvalidate();
  const reorder = useReorder("arrangements");
  const [editing, setEditing] = useState<Partial<Arrangement> | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [lyricFor, setLyricFor] = useState<Arrangement | null>(null);
  const [sort, setSort] = useState<SortMode>("alfabetico");
  const [tag, setTag] = useState("");

  useEffect(() => {
    if (initialEditLyricId && arrangements.data?.length) {
      const match = arrangements.data.find((a) => a.id === initialEditLyricId);
      if (match) {
        setLyricFor(match);
      }
    }
  }, [initialEditLyricId, arrangements.data]);

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of arrangements.data ?? []) {
      for (const t of a.tags ?? []) {
        const norm = normalize(t);
        if (norm && !map.has(norm)) {
          map.set(norm, t);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [arrangements.data]);

  const list = useMemo(() => {
    const sorted = (arrangements.data ?? []).filter(
      (a) => !tag || (a.tags ?? []).some((t) => normalize(t) === normalize(tag))
    );
    const copy = [...sorted];
    if (sort === "alfabetico") copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "duracion") copy.sort((a, b) => b.duration_seconds - a.duration_seconds);
    if (sort === "manual") copy.sort((a, b) => a.sort_order - b.sort_order);
    return copy;
  }, [arrangements.data, sort, tag]);

  const [lastDeletedArrangement, setLastDeletedArrangement] = useState<{
    arrangement: Arrangement;
    lyric?: Lyric | null;
  } | null>(null);

  function handleReorder(newItems: Arrangement[]) {
    reorder.mutate(newItems.map((a) => a.id));
  }

  async function remove(arrangement: Arrangement) {
    if (!confirm(`¿Eliminar el arreglo "${arrangement.title}" y sus datos asociados?`)) return;

    const { data: lyricData } = await supabase
      .from("lyrics")
      .select("*")
      .eq("arrangement_id", arrangement.id)
      .maybeSingle();

    const backup = { arrangement, lyric: lyricData };
    setLastDeletedArrangement(backup);

    const { error } = await supabase.from("arrangements").delete().eq("id", arrangement.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("arrangements", "setlist_items", "play_events", "lyrics");

    toast(`Arreglo "${arrangement.title}" eliminado`, {
      action: {
        label: "Deshacer",
        onClick: () => restoreArrangement(backup),
      },
      duration: 10000,
    });
  }

  async function restoreArrangement(backup?: { arrangement: Arrangement; lyric?: Lyric | null } | null) {
    const target = backup || lastDeletedArrangement;
    if (!target) return;

    const { error } = await supabase.from("arrangements").insert({
      id: target.arrangement.id,
      title: target.arrangement.title,
      duration_seconds: target.arrangement.duration_seconds,
      tags: target.arrangement.tags,
      sort_order: target.arrangement.sort_order,
    });

    if (error) {
      toast.error("Error al restaurar: " + error.message);
      return;
    }

    if (target.lyric) {
      await supabase.from("lyrics").insert({
        id: target.lyric.id,
        kind: target.lyric.kind,
        title: target.lyric.title,
        content: target.lyric.content,
        plain_text: target.lyric.plain_text,
        arrangement_id: target.lyric.arrangement_id,
        street_song_id: target.lyric.street_song_id,
      });
    }

    setLastDeletedArrangement(null);
    invalidate("arrangements", "setlist_items", "play_events", "lyrics");
    toast.success(`Arreglo "${target.arrangement.title}" restaurado`);
  }

  const total = (arrangements.data ?? []).reduce((s, a) => s + a.duration_seconds, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-muted-foreground">
          {arrangements.data?.length ?? 0} arreglos · {formatLongDuration(total)} en total
        </p>
        <div className="flex items-center gap-2">
          {lastDeletedArrangement && (
            <button
              onClick={() => restoreArrangement()}
              className="comic-sm flex items-center gap-1 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1 text-[11px] font-bold transition-colors border border-border/50"
              title="Restaurar el último arreglo eliminado"
            >
              <Undo2 className="h-3 w-3" /> Deshacer
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="comic comic-press flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm font-extrabold uppercase text-secondary-foreground"
          >
            <FileSpreadsheet className="h-4 w-4" /> Importar Excel
          </button>
          <button
            onClick={() => setEditing({})}
            className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nuevo arreglo
          </button>
        </div>
      </div>

      <SortBar value={sort} onChange={setSort} options={["alfabetico", "duracion", "manual"]} />

      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          <button
            onClick={() => setTag("")}
            className={`comic-sm rounded px-2 py-1 text-xs font-bold uppercase ${
              tag === "" ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            Todas
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t === tag ? "" : t)}
              className={`comic-sm rounded px-2 py-1 text-xs font-bold uppercase ${
                tag === t ? "bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {sort === "manual" ? (
        <div className="space-y-2">
          <SortableList items={list} onReorder={handleReorder} strategy="vertical">
            {(a) => (
              <SortableItem
                key={a.id}
                id={a.id}
                handleOnly
                className="comic grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xl leading-tight">{a.title}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {formatDuration(a.duration_seconds)}
                    {lyrics.data?.some((l) => l.arrangement_id === a.id) ? " · con letra" : ""}
                  </p>
                  {!!a.tags?.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.tags.map((t) => (
                        <span
                          key={t}
                          className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setLyricFor(a)}
                    aria-label={`Letra de ${a.title}`}
                    className="comic-sm comic-press rounded bg-accent p-2 text-accent-foreground"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditing(a)}
                    aria-label={`Editar ${a.title}`}
                    className="comic-sm comic-press rounded bg-secondary p-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(a)}
                    aria-label={`Eliminar ${a.title}`}
                    className="comic-sm comic-press rounded bg-destructive p-2 text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </SortableItem>
            )}
          </SortableList>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div
              key={a.id}
              className="comic grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xl leading-tight">{a.title}</p>
                <p className="text-xs font-bold text-muted-foreground">
                  {formatDuration(a.duration_seconds)}
                  {lyrics.data?.some((l) => l.arrangement_id === a.id) ? " · con letra" : ""}
                </p>
                {!!a.tags?.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setLyricFor(a)}
                  aria-label={`Letra de ${a.title}`}
                  className="comic-sm comic-press rounded bg-accent p-2 text-accent-foreground"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditing(a)}
                  aria-label={`Editar ${a.title}`}
                  className="comic-sm comic-press rounded bg-secondary p-2"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(a.id)}
                  aria-label={`Eliminar ${a.title}`}
                  className="comic-sm comic-press rounded bg-destructive p-2 text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lyricFor && (
        <LyricDialog
          kind="arreglo"
          refId={lyricFor.id}
          defaultTitle={lyricFor.title}
          existing={(lyrics.data ?? []).find((l) => l.arrangement_id === lyricFor.id) ?? null}
          onClose={() => setLyricFor(null)}
        />
      )}

      {showImport && (
        <ImportExcelDialog
          onClose={() => setShowImport(false)}
          onImported={() => invalidate("arrangements")}
          existingTitles={
            new Set((arrangements.data ?? []).map((a) => a.title.toUpperCase().trim()))
          }
        />
      )}

      {editing && (
        <ArrangementDialog
          arrangement={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate("arrangements");
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RepertorioCalle({ initialEditLyricId }: { initialEditLyricId?: string }) {
  const songs = useStreetSongs();
  const lyrics = useLyrics();
  const invalidate = useInvalidate();
  const reorder = useReorder("street_songs");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StreetSong | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("alfabetico");
  const [lyricFor, setLyricFor] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (initialEditLyricId && songs.data?.length) {
      const match = songs.data.find((s) => s.id === initialEditLyricId);
      if (match) {
        setLyricFor({ id: match.id, title: match.title });
      }
    }
  }, [initialEditLyricId, songs.data]);

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of songs.data ?? []) {
      for (const t of s.tags ?? []) {
        const norm = normalize(t);
        if (norm && !map.has(norm)) {
          map.set(norm, t);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [songs.data]);

  const list = useMemo(() => {
    let base = (songs.data ?? []).filter(
      (s) => !tag || (s.tags ?? []).some((t) => normalize(t) === normalize(tag))
    );
    if (search.trim()) {
      const q = normalize(search.trim());
      base = base.filter(
        (s) => normalize(s.title).includes(q) || (s.tags ?? []).some((t) => normalize(t).includes(q))
      );
    }
    const copy = [...base];
    if (sort === "alfabetico") copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "manual") copy.sort((a, b) => a.sort_order - b.sort_order);
    return copy;
  }, [songs.data, search, sort, tag]);

  const [lastDeletedStreetSong, setLastDeletedStreetSong] = useState<{
    song: StreetSong;
    lyric?: Lyric | null;
  } | null>(null);

  function handleReorder(newItems: { id: string; title: string; sort_order: number }[]) {
    reorder.mutate(newItems.map((s) => s.id));
  }

  async function removeSong(song: StreetSong) {
    if (!confirm(`¿Eliminar la canción "${song.title}"?`)) return;

    const { data: lyricData } = await supabase
      .from("lyrics")
      .select("*")
      .eq("street_song_id", song.id)
      .maybeSingle();

    const backup = { song, lyric: lyricData };
    setLastDeletedStreetSong(backup);

    const { error } = await supabase.from("street_songs").delete().eq("id", song.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("street_songs", "play_events", "lyrics");

    toast(`Canción "${song.title}" eliminada`, {
      action: {
        label: "Deshacer",
        onClick: () => restoreStreetSong(backup),
      },
      duration: 10000,
    });
  }

  async function restoreStreetSong(backup?: { song: StreetSong; lyric?: Lyric | null } | null) {
    const target = backup || lastDeletedStreetSong;
    if (!target) return;

    const { error } = await supabase.from("street_songs").insert({
      id: target.song.id,
      title: target.song.title,
      tags: target.song.tags,
      sort_order: target.song.sort_order,
    });

    if (error) {
      toast.error("Error al restaurar: " + error.message);
      return;
    }

    if (target.lyric) {
      await supabase.from("lyrics").insert({
        id: target.lyric.id,
        kind: target.lyric.kind,
        title: target.lyric.title,
        content: target.lyric.content,
        plain_text: target.lyric.plain_text,
        arrangement_id: target.lyric.arrangement_id,
        street_song_id: target.lyric.street_song_id,
      });
    }

    setLastDeletedStreetSong(null);
    invalidate("street_songs", "play_events", "lyrics");
    toast.success(`Canción "${target.song.title}" restaurada`);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-muted-foreground">
          {songs.data?.length ?? 0} canciones de calle
        </p>
        <div className="flex items-center gap-2">
          {lastDeletedStreetSong && (
            <button
              onClick={() => restoreStreetSong()}
              className="comic-sm flex items-center gap-1 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1 text-[11px] font-bold transition-colors border border-border/50"
              title="Restaurar la última canción eliminada"
            >
              <Undo2 className="h-3 w-3" /> Deshacer
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="comic comic-press flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm font-extrabold uppercase text-secondary-foreground"
          >
            <FileSpreadsheet className="h-4 w-4" /> Importar Lista
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
            className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nueva canción de calle
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTag("")}
            className={`comic-sm rounded px-2.5 py-1 text-xs font-extrabold uppercase ${
              tag === "" ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            Todas ({songs.data?.length ?? 0})
          </button>
          {allTags.map((t) => (
            <button
              key={t}
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
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar canción de calle…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
      </div>

      <SortBar value={sort} onChange={setSort} options={["alfabetico", "manual"]} />

      {sort === "manual" ? (
        <div className="space-y-2">
          <SortableList items={list} onReorder={handleReorder} strategy="vertical">
            {(s) => (
              <SortableItem
                key={s.id}
                id={s.id}
                handleOnly
                className="comic grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xl leading-tight">{s.title}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {lyrics.data?.some((l) => l.street_song_id === s.id) ? "Con letra" : "Sin letra"}
                  </p>
                  {!!s.tags?.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <span
                          key={t}
                          className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setLyricFor({ id: s.id, title: s.title })}
                    aria-label={`Letra de ${s.title}`}
                    className="comic-sm comic-press rounded bg-accent p-2 text-accent-foreground"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(s);
                      setAdding(true);
                    }}
                    aria-label={`Editar ${s.title}`}
                    className="comic-sm comic-press rounded bg-secondary p-2 text-secondary-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => removeSong(s)}
                    aria-label={`Eliminar ${s.title}`}
                    className="comic-sm comic-press rounded bg-destructive p-2 text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </SortableItem>
            )}
          </SortableList>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div
              key={s.id}
              className="comic grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xl leading-tight">{s.title}</p>
                <p className="text-xs font-bold text-muted-foreground">
                  {lyrics.data?.some((l) => l.street_song_id === s.id) ? "Con letra" : "Sin letra"}
                </p>
                {!!s.tags?.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setLyricFor({ id: s.id, title: s.title })}
                  aria-label={`Letra de ${s.title}`}
                  className="comic-sm comic-press rounded bg-accent p-2 text-accent-foreground"
                >
                  <FileText className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEditing(s);
                    setAdding(true);
                  }}
                  aria-label={`Editar ${s.title}`}
                  className="comic-sm comic-press rounded bg-secondary p-2 text-secondary-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeSong(s)}
                  aria-label={`Eliminar ${s.title}`}
                  className="comic-sm comic-press rounded bg-destructive p-2 text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lyricFor && (
        <LyricDialog
          kind="calle"
          refId={lyricFor.id}
          defaultTitle={lyricFor.title}
          existing={(lyrics.data ?? []).find((l) => l.street_song_id === lyricFor.id) ?? null}
          onClose={() => setLyricFor(null)}
        />
      )}

      {showImport && (
        <ImportCalleDialog
          onClose={() => setShowImport(false)}
          onImported={() => invalidate("street_songs", "lyrics")}
          existingTitles={
            new Set((songs.data ?? []).map((s) => s.title.toUpperCase().trim()))
          }
        />
      )}

      {adding && (
        <StreetSongDialog
          song={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            invalidate("street_songs");
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StreetSongDialog({
  song,
  onClose,
  onSaved,
}: {
  song: Partial<StreetSong> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(song?.title ?? "");
  const [tags, setTags] = useState<string[]>(song?.tags ?? []);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Pon un título");
      return;
    }
    setBusy(true);
    const payload = {
      title: title.trim(),
      tags: tags.map((t) => t.trim()).filter(Boolean),
    };

    const { error } = song?.id
      ? await supabase.from("street_songs").update(payload).eq("id", song.id)
      : await supabase.from("street_songs").insert(payload);

    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(song?.id ? "Canción de calle actualizada" : "Canción de calle añadida");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="comic w-full max-w-md rounded-xl bg-card p-4">
        <div className="mb-3 flex items-center">
          <h2 className="mr-auto text-2xl leading-none">
            {song?.id ? "Editar canción de calle" : "Nueva canción de calle"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-3 block text-sm font-bold uppercase">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Título de la canción"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <div className="mb-4 block text-sm font-bold uppercase">
          <span className="mb-1 block">Etiquetas</span>
          <TagInput tags={tags} onChange={setTags} placeholder="Añadir etiqueta (ej. Pop + Intro)" />
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="comic comic-press w-full rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function ArrangementDialog({
  arrangement,
  onClose,
  onSaved,
}: {
  arrangement: Partial<Arrangement>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(arrangement.title ?? "");
  const [minutes, setMinutes] = useState(
    String(Math.floor((arrangement.duration_seconds ?? 0) / 60)),
  );
  const [seconds, setSeconds] = useState(String((arrangement.duration_seconds ?? 0) % 60));
  const [tags, setTags] = useState<string[]>(arrangement.tags ?? []);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Pon un título");
      return;
    }
    setBusy(true);
    const payload = {
      title: title.trim(),
      duration_seconds:
        (parseInt(minutes || "0", 10) || 0) * 60 + (parseInt(seconds || "0", 10) || 0),
      tags: tags.map((t) => t.trim()).filter(Boolean),
    };
    const { error } = arrangement.id
      ? await supabase.from("arrangements").update(payload).eq("id", arrangement.id)
      : await supabase.from("arrangements").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Arreglo guardado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="comic w-full max-w-md rounded-xl bg-card p-4">
        <div className="mb-3 flex items-center">
          <h2 className="mr-auto text-2xl leading-none">
            {arrangement.id ? "Editar arreglo" : "Nuevo arreglo"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-3 block text-sm font-bold uppercase">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold uppercase">
            Minutos
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
            />
          </label>
          <label className="block text-sm font-bold uppercase">
            Segundos
            <input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
            />
          </label>
        </div>

        <div className="mb-4 block text-sm font-bold uppercase">
          <span className="mb-1 block">Etiquetas</span>
          <TagInput tags={tags} onChange={setTags} placeholder="Añadir etiqueta (ej. pasodoble + Intro)" />
        </div>

        <button
          onClick={save}
          disabled={busy}
          className="comic comic-press w-full rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
