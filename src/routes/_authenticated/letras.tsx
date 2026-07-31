import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  useArrangements,
  useLyrics,
  useStreetSongs,
  useInvalidate,
  type Lyric,
} from "@/lib/queries";
import { htmlToPlainText, normalize, sanitizeLyricsHtml, formatDuration } from "@/lib/format";

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

type Kind = "street" | "arrangement";

function Letras() {
  const [kind, setKind] = useState<Kind>("street");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<Lyric> | null>(null);
  const lyrics = useLyrics();
  const arrangements = useArrangements();
  const street = useStreetSongs();
  const invalidate = useInvalidate();

  const list = useMemo(() => {
    const q = normalize(query.trim());
    return (lyrics.data ?? [])
      .filter((l) => l.kind === kind)
      .filter(
        (l) => !q || normalize(l.title).includes(q) || normalize(l.plain_text).includes(q),
      );
  }, [lyrics.data, kind, query]);

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta letra?")) return;
    const { error } = await supabase.from("lyrics").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("lyrics");
    toast.success("Letra eliminada");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-4xl leading-none">Letras</h1>
        <button
          onClick={() => setEditing({ kind })}
          className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Añadir letra
        </button>
      </div>

      <div className="comic-sm mb-3 flex overflow-hidden rounded-md">
        {(
          [
            ["street", "Calle"],
            ["arrangement", "Arreglos"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className={`flex-1 px-3 py-2 text-sm font-extrabold uppercase ${
              kind === value ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="comic-sm mb-4 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o texto de la letra…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {lyrics.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {!lyrics.isLoading && list.length === 0 && (
        <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
          No hay letras que coincidan.
        </p>
      )}

      <div className="space-y-3">
        {list.map((lyric) => {
          const arrangement = arrangements.data?.find((a) => a.id === lyric.arrangement_id);
          return (
            <details key={lyric.id} className="comic rounded-xl bg-card p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-2xl leading-none">
                  {lyric.title}
                </span>
                {arrangement && (
                  <span className="comic-sm shrink-0 rounded bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                    {formatDuration(arrangement.duration_seconds)}
                  </span>
                )}
              </summary>
              <div
                className="lyrics-body mt-3 whitespace-pre-wrap text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: lyric.content }}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditing(lyric)}
                  className="comic-sm comic-press flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs font-bold uppercase"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button
                  onClick={() => remove(lyric.id)}
                  className="comic-sm comic-press flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs font-bold uppercase text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" /> Borrar
                </button>
              </div>
            </details>
          );
        })}
      </div>

      {editing && (
        <LyricDialog
          lyric={editing}
          arrangements={arrangements.data ?? []}
          streetSongs={street.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate("lyrics", "street_songs");
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function LyricDialog({
  lyric,
  arrangements,
  streetSongs,
  onClose,
  onSaved,
}: {
  lyric: Partial<Lyric>;
  arrangements: { id: string; title: string }[];
  streetSongs: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const kind = (lyric.kind ?? "street") as Kind;
  const [title, setTitle] = useState(lyric.title ?? "");
  const [content, setContent] = useState(lyric.content ?? "");
  const [linkId, setLinkId] = useState(
    (kind === "street" ? lyric.street_song_id : lyric.arrangement_id) ?? "",
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Pon un título");
      return;
    }
    setBusy(true);
    try {
      const clean = sanitizeLyricsHtml(content);
      let streetSongId = kind === "street" ? linkId || null : null;

      if (kind === "street" && !streetSongId) {
        const existing = streetSongs.find(
          (s) => normalize(s.title) === normalize(title.trim()),
        );
        if (existing) {
          streetSongId = existing.id;
        } else {
          const { data, error } = await supabase
            .from("street_songs")
            .insert({ title: title.trim() })
            .select("id")
            .single();
          if (error) throw error;
          streetSongId = data.id;
        }
      }

      const payload = {
        kind,
        title: title.trim(),
        content: clean,
        plain_text: htmlToPlainText(clean),
        street_song_id: streetSongId,
        arrangement_id: kind === "arrangement" ? linkId || null : null,
      };

      if (lyric.id) {
        const { error } = await supabase.from("lyrics").update(payload).eq("id", lyric.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lyrics").insert(payload);
        if (error) throw error;
      }
      toast.success("Letra guardada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4">
      <div className="comic w-full max-w-2xl rounded-xl bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto text-2xl leading-none">
            {lyric.id ? "Editar letra" : "Nueva letra"} · {kind === "street" ? "Calle" : "Arreglo"}
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

        {kind === "arrangement" && (
          <label className="mb-3 block text-sm font-bold uppercase">
            Arreglo vinculado
            <select
              value={linkId}
              onChange={(e) => {
                setLinkId(e.target.value);
                const found = arrangements.find((a) => a.id === e.target.value);
                if (found && !title.trim()) setTitle(found.title);
              }}
              className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
            >
              <option value="">Sin vincular</option>
              {arrangements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === "street" && (
          <label className="mb-3 block text-sm font-bold uppercase">
            Canción de calle
            <select
              value={linkId}
              onChange={(e) => {
                setLinkId(e.target.value);
                const found = streetSongs.find((s) => s.id === e.target.value);
                if (found && !title.trim()) setTitle(found.title);
              }}
              className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
            >
              <option value="">Crear nueva con este título</option>
              {streetSongs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mb-4">
          <span className="mb-1 block text-sm font-bold uppercase">Letra</span>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="comic comic-press flex-1 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground disabled:opacity-60"
          >
            Guardar
          </button>
          <button
            onClick={onClose}
            className="comic comic-press rounded-md bg-secondary px-4 py-2 font-extrabold uppercase"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
