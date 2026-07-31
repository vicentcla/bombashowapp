import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, X, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useArrangements,
  useSetlists,
  useSetlistItems,
  useInvalidate,
  type Arrangement,
} from "@/lib/queries";
import { formatDuration, formatLongDuration } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/repertorio")({
  head: () => ({
    meta: [
      { title: "Repertorio y setlists — La Bomba Show" },
      {
        name: "description",
        content: "Catálogo de arreglos con duración y construcción de setlists por concierto.",
      },
      { property: "og:title", content: "Repertorio y setlists — La Bomba Show" },
      {
        property: "og:description",
        content: "Catálogo de arreglos con duración y construcción de setlists por concierto.",
      },
    ],
  }),
  component: Repertorio,
});

function Repertorio() {
  const [tab, setTab] = useState<"catalogo" | "setlists">("catalogo");

  return (
    <div>
      <h1 className="mb-4 text-4xl leading-none">Repertorio</h1>
      <div className="comic-sm mb-4 flex overflow-hidden rounded-md">
        {(
          [
            ["catalogo", "Arreglos"],
            ["setlists", "Setlists"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 px-3 py-2 text-sm font-extrabold uppercase ${
              tab === value ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "catalogo" ? <Catalogo /> : <Setlists />}
    </div>
  );
}

function Catalogo() {
  const arrangements = useArrangements();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<Partial<Arrangement> | null>(null);

  async function remove(id: string) {
    if (!confirm("¿Eliminar este arreglo?")) return;
    const { error } = await supabase.from("arrangements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("arrangements", "setlist_items", "play_events");
  }

  const total = (arrangements.data ?? []).reduce((s, a) => s + a.duration_seconds, 0);

  return (
    <div>
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

      <div className="space-y-2">
        {(arrangements.data ?? []).map((a) => (
          <div
            key={a.id}
            className="comic grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-xl leading-tight">{a.title}</p>
              <p className="text-xs font-bold text-muted-foreground">
                {formatDuration(a.duration_seconds)}
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
      duration_seconds: (parseInt(minutes || "0", 10) || 0) * 60 + (parseInt(seconds || "0", 10) || 0),
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

function Setlists() {
  const setlists = useSetlists();
  const invalidate = useInvalidate();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error("Pon un nombre al setlist");
      return;
    }
    const { data, error } = await supabase
      .from("setlists")
      .insert({ name: name.trim(), event_date: date || null })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setDate("");
    setCreating(false);
    invalidate("setlists");
    setSelected(data.id);
  }

  async function removeSetlist(id: string) {
    if (!confirm("¿Eliminar este setlist?")) return;
    const { error } = await supabase.from("setlists").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selected === id) setSelected(null);
    invalidate("setlists");
  }

  if (selected) {
    return <SetlistDetail setlistId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nuevo setlist
        </button>
      </div>

      {setlists.data?.length === 0 && (
        <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
          Todavía no has creado ningún setlist.
        </p>
      )}

      <div className="space-y-2">
        {(setlists.data ?? []).map((s) => (
          <div
            key={s.id}
            className="comic grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
          >
            <button onClick={() => setSelected(s.id)} className="min-w-0 text-left">
              <p className="truncate text-xl leading-tight">{s.name}</p>
              {s.event_date && (
                <p className="text-xs font-bold text-muted-foreground">
                  {new Date(s.event_date).toLocaleDateString("es-ES")}
                </p>
              )}
            </button>
            <button
              onClick={() => removeSetlist(s.id)}
              aria-label={`Eliminar ${s.name}`}
              className="comic-sm comic-press shrink-0 rounded bg-destructive p-2 text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div className="comic w-full max-w-sm rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center">
              <h2 className="mr-auto text-2xl leading-none">Nuevo setlist</h2>
              <button onClick={() => setCreating(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre (p. ej. Fiestas de agosto)"
              maxLength={120}
              className="comic-sm mb-3 w-full rounded-md bg-background px-3 py-2 outline-none"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="comic-sm mb-3 w-full rounded-md bg-background px-3 py-2 outline-none"
            />
            <button
              onClick={create}
              className="comic comic-press w-full rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground"
            >
              Crear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SetlistDetail({ setlistId, onBack }: { setlistId: string; onBack: () => void }) {
  const items = useSetlistItems(setlistId);
  const arrangements = useArrangements();
  const setlists = useSetlists();
  const invalidate = useInvalidate();
  const [toAdd, setToAdd] = useState("");

  const setlist = setlists.data?.find((s) => s.id === setlistId);
  const total = useMemo(
    () => (items.data ?? []).reduce((s, i) => s + (i.arrangements?.duration_seconds ?? 0), 0),
    [items.data],
  );

  async function add() {
    if (!toAdd) return;
    const position = (items.data?.length ?? 0) + 1;
    const { error } = await supabase
      .from("setlist_items")
      .insert({ setlist_id: setlistId, arrangement_id: toAdd, position });
    if (error) {
      toast.error(error.message);
      return;
    }
    setToAdd("");
    invalidate("setlist_items");
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("setlist_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("setlist_items");
  }

  async function move(index: number, dir: -1 | 1) {
    const list = items.data ?? [];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const a = list[index]!;
    const b = list[target]!;
    const { error } = await supabase
      .from("setlist_items")
      .upsert([
        { id: a.id, setlist_id: setlistId, arrangement_id: a.arrangement_id, position: b.position },
        { id: b.id, setlist_id: setlistId, arrangement_id: b.arrangement_id, position: a.position },
      ]);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("setlist_items");
  }

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-sm font-bold underline">
        ← Volver a los setlists
      </button>

      <div className="comic mb-4 rounded-xl bg-accent p-4 text-accent-foreground">
        <h2 className="text-3xl leading-none">{setlist?.name}</h2>
        <p className="mt-1 text-sm font-bold">
          {items.data?.length ?? 0} arreglos · Duración total {formatLongDuration(total)}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          value={toAdd}
          onChange={(e) => setToAdd(e.target.value)}
          className="comic-sm min-w-0 rounded-md bg-card px-3 py-2 outline-none"
        >
          <option value="">Añadir arreglo…</option>
          {(arrangements.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} ({formatDuration(a.duration_seconds)})
            </option>
          ))}
        </select>
        <button
          onClick={add}
          className="comic comic-press shrink-0 rounded-md bg-primary px-3 py-2 font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <ol className="space-y-2">
        {(items.data ?? []).map((item, index) => (
          <li
            key={item.id}
            className="comic grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-card p-3"
          >
            <span className="shrink-0 text-2xl leading-none text-primary">{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate text-lg leading-tight">{item.arrangements?.title}</p>
              <p className="text-xs font-bold text-muted-foreground">
                {formatDuration(item.arrangements?.duration_seconds ?? 0)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => move(index, -1)}
                aria-label="Subir"
                className="comic-sm comic-press rounded bg-secondary p-1.5"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(index, 1)}
                aria-label="Bajar"
                className="comic-sm comic-press rounded bg-secondary p-1.5"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => removeItem(item.id)}
                aria-label="Quitar del setlist"
                className="comic-sm comic-press rounded bg-destructive p-1.5 text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
