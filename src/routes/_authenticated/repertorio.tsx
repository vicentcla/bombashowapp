import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, X, Pencil, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LyricDialog } from "@/components/LyricDialog";
import { SortBar, type SortMode } from "@/components/SortBar";
import { useArrangements, useLyrics, useInvalidate, useReorder, type Arrangement } from "@/lib/queries";
import { formatDuration, formatLongDuration } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/repertorio")({
  head: () => ({
    meta: [
      { title: "Repertorio de arreglos — La Bomba Show" },
      {
        name: "description",
        content: "Catálogo de arreglos con duración, etiquetas y letra de cada uno.",
      },
      { property: "og:title", content: "Repertorio de arreglos — La Bomba Show" },
      {
        property: "og:description",
        content: "Catálogo de arreglos con duración, etiquetas y letra de cada uno.",
      },
    ],
  }),
  component: Repertorio,
});

function Repertorio() {
  const arrangements = useArrangements();
  const lyrics = useLyrics();
  const invalidate = useInvalidate();
  const reorder = useReorder("arrangements");
  const [editing, setEditing] = useState<Partial<Arrangement> | null>(null);
  const [lyricFor, setLyricFor] = useState<Arrangement | null>(null);
  const [sort, setSort] = useState<SortMode>("alfabetico");
  const [tag, setTag] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of arrangements.data ?? []) for (const t of a.tags ?? []) set.add(t);
    return [...set].sort();
  }, [arrangements.data]);

  const list = useMemo(() => {
    const sorted = (arrangements.data ?? []).filter((a) => !tag || (a.tags ?? []).includes(tag));
    const copy = [...sorted];
    if (sort === "alfabetico") copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "duracion") copy.sort((a, b) => b.duration_seconds - a.duration_seconds);
    if (sort === "manual") copy.sort((a, b) => a.sort_order - b.sort_order);
    return copy;
  }, [arrangements.data, sort, tag]);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((a) => a.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved!);
    reorder.mutate(ids);
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este arreglo?")) return;
    const { error } = await supabase.from("arrangements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("arrangements", "setlist_items", "play_events", "lyrics");
  }

  const total = (arrangements.data ?? []).reduce((s, a) => s + a.duration_seconds, 0);

  return (
    <div>
      <h1 className="mb-1 text-4xl leading-none">Repertorio</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Aquí se construye todo: arreglos, duraciones, etiquetas y letras.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-bold text-muted-foreground">
          {arrangements.data?.length ?? 0} arreglos · {formatLongDuration(total)} en total
        </p>
        <button
          onClick={() => setEditing({})}
          className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nuevo arreglo
        </button>
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

      <div className="space-y-2">
        {list.map((a, index) => (
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
              {sort === "manual" && (
                <>
                  <button
                    onClick={() => move(index, -1)}
                    aria-label={`Subir ${a.title}`}
                    className="comic-sm comic-press rounded bg-secondary p-2"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    aria-label={`Bajar ${a.title}`}
                    className="comic-sm comic-press rounded bg-secondary p-2"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </>
              )}
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

      {lyricFor && (
        <LyricDialog
          kind="arreglo"
          refId={lyricFor.id}
          defaultTitle={lyricFor.title}
          existing={(lyrics.data ?? []).find((l) => l.arrangement_id === lyricFor.id) ?? null}
          onClose={() => setLyricFor(null)}
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
  const [tags, setTags] = useState((arrangement.tags ?? []).join(", "));
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
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
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

        <label className="mb-4 block text-sm font-bold uppercase">
          Etiquetas (separadas por comas)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="pasodoble, rumba, lento"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

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
