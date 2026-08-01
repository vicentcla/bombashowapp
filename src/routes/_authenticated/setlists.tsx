import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  X,
  Clock,
  Calendar,
  Layers,
  Settings,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Search,
  Music2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useArrangements,
  useSetlists,
  useSetlistItems,
  useInvalidate,
  type Arrangement,
} from "@/lib/queries";
import {
  formatDuration,
  formatLongDuration,
  formatMinutesToHours,
  formatTimeComparison,
} from "@/lib/format";
import { SortableList, SortableItem } from "@/components/SortableList";

export const Route = createFileRoute("/_authenticated/setlists")({
  head: () => ({
    meta: [
      { title: "Setlists — La Bomba Show" },
      {
        name: "description",
        content: "Organiza el repertorio en pases con duración objetivo y seguimiento en tiempo real.",
      },
    ],
  }),
  component: SetlistsPage,
});

// ─── Estructuras de datos para Configuración de Pases y Tiempos ─────────────────

export type PassConfig = {
  id: string;
  name: string;
  target_minutes: number;
};

export type SetlistNotesConfig = {
  target_minutes: number;
  passes: PassConfig[];
  item_pass_map: Record<string, string>; // item_id -> pass_id
  notes_text?: string;
};

export function parseSetlistNotes(notes: string | null): SetlistNotesConfig {
  if (!notes) {
    return {
      target_minutes: 0,
      passes: [{ id: "p1", name: "Pase único", target_minutes: 0 }],
      item_pass_map: {},
    };
  }
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") {
      const target_minutes = Number(parsed.target_minutes) || 0;
      const passes =
        Array.isArray(parsed.passes) && parsed.passes.length > 0
          ? parsed.passes.map((p: Record<string, unknown>, i: number) => ({
              id: String(p['id'] || `p${i + 1}`),
              name: String(p['name'] || `Pase ${i + 1}`),
              target_minutes: Number(p['target_minutes']) || 0,
            }))
          : [{ id: "p1", name: "Pase único", target_minutes }];
      const item_pass_map =
        typeof parsed.item_pass_map === "object" && parsed.item_pass_map
          ? (parsed.item_pass_map as Record<string, string>)
          : {};
      return {
        target_minutes,
        passes,
        item_pass_map,
        notes_text: typeof parsed.notes_text === "string" ? parsed.notes_text : "",
      };
    }
  } catch {
    // Si no es un JSON válido, conservamos como texto normal
  }
  return {
    target_minutes: 0,
    passes: [{ id: "p1", name: "Pase único", target_minutes: 0 }],
    item_pass_map: {},
    notes_text: notes,
  };
}

export function serializeSetlistNotes(config: SetlistNotesConfig): string {
  return JSON.stringify(config);
}

// ─── Componente Principal SetlistsPage ──────────────────────────────────────────

function SetlistsPage() {
  const setlists = useSetlists();
  const invalidate = useInvalidate();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Formulario nuevo setlist
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(90);
  const [numPasses, setNumPasses] = useState(2);
  const [passDurations, setPassDurations] = useState<number[]>([45, 45]);

  function handleNumPassesChange(n: number) {
    setNumPasses(n);
    const avg = Math.round(targetMinutes / n);
    const arr = Array.from({ length: n }, (_, i) => passDurations[i] || avg);
    setPassDurations(arr);
  }

  function handleTargetMinutesChange(val: number) {
    setTargetMinutes(val);
    if (numPasses > 0) {
      const avg = Math.round(val / numPasses);
      setPassDurations(Array.from({ length: numPasses }, () => avg));
    }
  }

  async function createSetlist() {
    if (!name.trim()) {
      toast.error("Por favor introduce un nombre para el setlist");
      return;
    }

    const passes: PassConfig[] = Array.from({ length: numPasses }, (_, i) => ({
      id: `p${i + 1}`,
      name: numPasses === 1 ? "Pase único" : `Pase ${i + 1}`,
      target_minutes: passDurations[i] || 0,
    }));

    const config: SetlistNotesConfig = {
      target_minutes: targetMinutes,
      passes,
      item_pass_map: {},
    };

    const { data, error } = await supabase
      .from("setlists")
      .insert({
        name: name.trim(),
        event_date: date || null,
        notes: serializeSetlistNotes(config),
      })
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
    toast.success("Setlist creado correctamente");
  }

  async function removeSetlist(id: string, setlistName: string) {
    if (!confirm(`¿Eliminar el setlist "${setlistName}"?`)) return;
    const { error } = await supabase.from("setlists").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selected === id) setSelected(null);
    invalidate("setlists");
    toast.success("Setlist eliminado");
  }

  if (selected) {
    return <SetlistDetail setlistId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="comic-sm rounded-lg bg-primary p-2.5 text-primary-foreground">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold leading-none">Setlists del show</h1>
            <p className="text-xs font-bold text-muted-foreground">
              Planifica pases, compara duraciones y controla los tiempos en vivo
            </p>
          </div>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="comic comic-press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nuevo setlist
        </button>
      </div>

      {setlists.data?.length === 0 && (
        <div className="comic rounded-xl bg-card p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary/60" />
          <p className="text-lg font-bold">Todavía no has creado ningún setlist.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea tu primer repertorio configurando la duración total y sus pases.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="comic comic-press mt-4 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground"
          >
            Crear mi primer setlist
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(setlists.data ?? []).map((s) => {
          const config = parseSetlistNotes(s.notes);
          return (
            <SetlistCard
              key={s.id}
              setlist={s}
              config={config}
              onSelect={() => setSelected(s.id)}
              onDelete={() => removeSetlist(s.id, s.name)}
            />
          );
        })}
      </div>

      {/* Modal Nuevo Setlist */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 p-4">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-2xl font-extrabold leading-none">Nuevo setlist</h2>
              <button onClick={() => setCreating(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Nombre del evento / show</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="P. ej. Fiestas Patronales - Noche"
                maxLength={120}
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Fecha del evento</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">
                Duración objetivo total (minutos)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={targetMinutes}
                  onChange={(e) => handleTargetMinutesChange(Number(e.target.value))}
                  className="comic-sm w-32 rounded-md bg-background px-3 py-2 text-base font-bold outline-none"
                />
                <span className="text-xs font-bold text-muted-foreground">
                  ({formatMinutesToHours(targetMinutes)})
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Número de pases / partes</label>
              <div className="comic-sm flex overflow-hidden rounded-md border bg-background">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleNumPassesChange(n)}
                    className={`flex-1 py-2 text-xs font-extrabold uppercase ${
                      numPasses === n
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {n} {n === 1 ? "Pase" : "Pases"}
                  </button>
                ))}
              </div>
            </div>

            {/* Duración de cada pase */}
            {numPasses > 1 && (
              <div className="rounded-lg bg-background p-3 space-y-2">
                <p className="text-xs font-extrabold uppercase text-muted-foreground">
                  Duración individual de cada pase:
                </p>
                {Array.from({ length: numPasses }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">Pase {i + 1}:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={passDurations[i] || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const next = [...passDurations];
                          next[i] = val;
                          setPassDurations(next);
                        }}
                        className="comic-sm w-20 rounded bg-card px-2 py-1 text-sm font-bold text-center outline-none"
                      />
                      <span className="text-xs font-bold text-muted-foreground">min</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={createSetlist}
              className="comic comic-press flex items-center justify-center gap-2 w-full rounded-md bg-primary py-3 font-extrabold uppercase text-primary-foreground"
            >
              <CheckCircle2 className="h-5 w-5" /> Crear Setlist
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta Individual de Setlist ──────────────────────────────────────────────

function SetlistCard({
  setlist,
  config,
  onSelect,
  onDelete,
}: {
  setlist: { id: string; name: string; event_date: string | null };
  config: SetlistNotesConfig;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const items = useSetlistItems(setlist.id);
  const totalSeconds = (items.data ?? []).reduce(
    (acc, i) => acc + (i.arrangements?.duration_seconds ?? 0),
    0,
  );

  const comp = formatTimeComparison(totalSeconds, config.target_minutes);

  return (
    <div className="comic flex flex-col justify-between rounded-xl bg-card p-4 space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <button onClick={onSelect} className="group min-w-0 text-left">
            <h2 className="truncate text-2xl font-extrabold group-hover:text-primary transition-colors">
              {setlist.name}
            </h2>
            {setlist.event_date && (
              <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(setlist.event_date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </button>
          <button
            onClick={onDelete}
            aria-label="Eliminar setlist"
            className="comic-sm comic-press rounded-md bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Badges de info */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="comic-sm rounded bg-secondary px-2 py-0.5 text-[11px] font-extrabold uppercase">
            {config.passes.length} {config.passes.length === 1 ? "pase" : "pases"}
          </span>
          <span className="comic-sm rounded bg-secondary px-2 py-0.5 text-[11px] font-extrabold uppercase">
            {items.data?.length ?? 0} temas
          </span>
          {config.target_minutes > 0 && (
            <span
              className={`comic-sm rounded px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                comp.status === "exact" || comp.status === "exceeded"
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {comp.diffText}
            </span>
          )}
        </div>
      </div>

      {/* Comparativa de Tiempos y Barra de Progreso */}
      <div className="space-y-1.5 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-xs font-extrabold">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {comp.addedText}
          </span>
          {config.target_minutes > 0 && (
            <span className="text-muted-foreground">Objetivo: {comp.targetText}</span>
          )}
        </div>

        {config.target_minutes > 0 && (
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary border border-ink/20">
            <div
              className={`h-full transition-all duration-500 ${
                comp.status === "exceeded"
                  ? "bg-amber-500"
                  : comp.percentage >= 100
                    ? "bg-emerald-500"
                    : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, comp.percentage)}%` }}
            />
          </div>
        )}

        <button
          onClick={onSelect}
          className="comic-sm comic-press mt-2 w-full rounded-lg bg-primary/10 hover:bg-primary py-2 text-xs font-extrabold uppercase text-primary hover:text-primary-foreground transition-colors text-center"
        >
          Abrir Setlist →
        </button>
      </div>
    </div>
  );
}

// ─── Detalle del Setlist (`SetlistDetail`) ─────────────────────────────────────

function SetlistDetail({ setlistId, onBack }: { setlistId: string; onBack: () => void }) {
  const setlists = useSetlists();
  const items = useSetlistItems(setlistId);
  const arrangements = useArrangements();
  const invalidate = useInvalidate();

  const setlist = setlists.data?.find((s) => s.id === setlistId);
  const config = useMemo(() => parseSetlistNotes(setlist?.notes ?? null), [setlist?.notes]);

  // Tab activo de pases ("all" o el id del pase)
  const [activePassId, setActivePassId] = useState<string>("all");
  const [searchSong, setSearchSong] = useState("");
  const [selectedSongId, setSelectedSongId] = useState("");
  const [editingConfig, setEditingConfig] = useState(false);

  // Formulario de edición de configuración
  const [editName, setEditName] = useState(setlist?.name || "");
  const [editDate, setEditDate] = useState(setlist?.event_date || "");
  const [editTargetMinutes, setEditTargetMinutes] = useState(config.target_minutes);
  const [editPasses, setEditPasses] = useState<PassConfig[]>(config.passes);

  // Mapeo de canción -> pase
  const itemPassMap = config.item_pass_map || {};

  // Total acumulado general
  const totalSecondsAll = useMemo(
    () => (items.data ?? []).reduce((acc, i) => acc + (i.arrangements?.duration_seconds ?? 0), 0),
    [items.data],
  );

  const overallComp = formatTimeComparison(totalSecondsAll, config.target_minutes);

  // Guardar configuración del setlist
  async function handleSaveConfig() {
    if (!setlist) return;

    const newConfig: SetlistNotesConfig = {
      target_minutes: editTargetMinutes,
      passes: editPasses,
      item_pass_map: itemPassMap,
    };

    const { error } = await supabase
      .from("setlists")
      .update({
        name: editName.trim() || setlist.name,
        event_date: editDate || null,
        notes: serializeSetlistNotes(newConfig),
      })
      .eq("id", setlistId);

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("setlists");
    setEditingConfig(false);
    toast.success("Configuración del setlist actualizada");
  }

  // Añadir un nuevo arreglo al setlist (en el pase actual o primero)
  async function handleAddSong(targetPassId?: string) {
    if (!selectedSongId) return;
    const passId = targetPassId || (activePassId !== "all" ? activePassId : config.passes[0]?.id || "p1");
    const position = (items.data?.length ?? 0) + 1;

    const { data: newItem, error } = await supabase
      .from("setlist_items")
      .insert({ setlist_id: setlistId, arrangement_id: selectedSongId, position })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    // Actualizamos el mapeo de pases en el setlist
    const newPassMap = { ...itemPassMap, [newItem.id]: passId };
    const updatedConfig: SetlistNotesConfig = { ...config, item_pass_map: newPassMap };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    setSelectedSongId("");
    invalidate("setlist_items", "setlists");
    toast.success("Arreglo añadido al setlist");
  }

  // Cambiar un arreglo de pase
  async function handleMoveItemToPass(itemId: string, newPassId: string) {
    const newPassMap = { ...itemPassMap, [itemId]: newPassId };
    const updatedConfig: SetlistNotesConfig = { ...config, item_pass_map: newPassMap };

    const { error } = await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("setlists");
  }

  // Eliminar arreglo
  async function handleRemoveItem(itemId: string) {
    const { error } = await supabase.from("setlist_items").delete().eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }

    const newPassMap = { ...itemPassMap };
    delete newPassMap[itemId];
    const updatedConfig: SetlistNotesConfig = { ...config, item_pass_map: newPassMap };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    invalidate("setlist_items", "setlists");
  }

  // Reordenar dentro de un pase
  async function handleReorderPassItems(reorderedItems: { id: string }[]) {
    const fullList = items.data ?? [];
    const idToPosition = new Map(fullList.map((item, idx) => [item.id, idx + 1]));

    await Promise.all(
      reorderedItems.map((item, index) => {
        return supabase
          .from("setlist_items")
          .update({ position: index + 1 })
          .eq("id", item.id);
      }),
    );

    invalidate("setlist_items");
  }

  // Filtrado de arreglos disponibles para añadir
  const availableArrangements = useMemo(() => {
    const q = searchSong.toLowerCase().trim();
    const all = arrangements.data ?? [];
    if (!q) return all;
    return all.filter(
      (a) => a.title.toLowerCase().includes(q) || (a.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [arrangements.data, searchSong]);

  return (
    <div className="space-y-6">
      {/* Botón Volver y Editar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-accent"
        >
          ← Volver a setlists
        </button>

        <button
          onClick={() => {
            setEditName(setlist?.name || "");
            setEditDate(setlist?.event_date || "");
            setEditTargetMinutes(config.target_minutes);
            setEditPasses(config.passes);
            setEditingConfig(true);
          }}
          className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-extrabold uppercase text-secondary-foreground"
        >
          <Settings className="h-3.5 w-3.5" /> Configurar Setlist
        </button>
      </div>

      {/* Banner Principal de Información y Duración Objetivo Total */}
      <div className="comic rounded-xl bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          <div>
            <h1 className="text-3xl font-extrabold leading-none">{setlist?.name}</h1>
            {setlist?.event_date && (
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(setlist.event_date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="comic-sm rounded bg-primary px-3 py-1 text-xs font-extrabold uppercase text-primary-foreground">
              {items.data?.length ?? 0} arreglos
            </span>
          </div>
        </div>

        {/* Indicadores Comparativos de Tiempo General */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-background p-3">
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Tiempo Añadido Total
            </p>
            <p className="text-2xl font-extrabold leading-tight text-primary">
              {overallComp.addedText}
            </p>
          </div>

          <div className="rounded-lg bg-background p-3">
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Duración Objetivo Total
            </p>
            <p className="text-2xl font-extrabold leading-tight">
              {config.target_minutes > 0 ? overallComp.targetText : "Sin objetivo"}
            </p>
          </div>

          <div className="rounded-lg bg-background p-3">
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Estado / Restante
            </p>
            <p className="text-2xl font-extrabold leading-tight flex items-center gap-1.5">
              {overallComp.status === "exceeded" ? (
                <span className="text-amber-500 flex items-center gap-1">
                  <AlertCircle className="h-5 w-5 shrink-0" /> {overallComp.diffText}
                </span>
              ) : overallComp.status === "exact" ? (
                <span className="text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-5 w-5 shrink-0" /> ¡Completado!
                </span>
              ) : (
                <span className="text-accent-foreground">{overallComp.diffText}</span>
              )}
            </p>
          </div>
        </div>

        {/* Barra de Progreso General */}
        {config.target_minutes > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-extrabold">
              <span>Progreso general: {overallComp.percentage}%</span>
              <span>
                {overallComp.addedText} / {overallComp.targetText}
              </span>
            </div>
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-secondary border border-ink/20">
              <div
                className={`h-full transition-all duration-500 ${
                  overallComp.status === "exceeded"
                    ? "bg-amber-500"
                    : overallComp.percentage >= 100
                      ? "bg-emerald-500"
                      : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, overallComp.percentage)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pestañas de Selección de Pases */}
      {config.passes.length > 1 && (
        <div className="comic-sm flex overflow-x-auto rounded-lg border bg-card p-1">
          <button
            onClick={() => setActivePassId("all")}
            className={`flex-1 min-w-[100px] px-3 py-2 text-xs font-extrabold uppercase rounded-md transition-colors ${
              activePassId === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos los pases ({config.passes.length})
          </button>
          {config.passes.map((p) => {
            const passItems = (items.data ?? []).filter(
              (i) => (itemPassMap[i.id] || config.passes[0]?.id) === p.id,
            );
            const passSeconds = passItems.reduce(
              (s, i) => s + (i.arrangements?.duration_seconds ?? 0),
              0,
            );
            return (
              <button
                key={p.id}
                onClick={() => setActivePassId(p.id)}
                className={`flex-1 min-w-[120px] px-3 py-2 text-xs font-extrabold uppercase rounded-md transition-colors ${
                  activePassId === p.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name} ({formatLongDuration(passSeconds)})
              </button>
            );
          })}
        </div>
      )}

      {/* Selector para añadir un arreglo al setlist */}
      <div className="comic rounded-xl bg-card p-4 space-y-3">
        <h3 className="text-sm font-extrabold uppercase text-muted-foreground flex items-center gap-1.5">
          <Music2 className="h-4 w-4 text-primary" /> Añadir arreglo al setlist
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
            <Search className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={selectedSongId}
              onChange={(e) => setSelectedSongId(e.target.value)}
              className="w-full bg-transparent text-base outline-none cursor-pointer"
            >
              <option value="">Seleccionar canción del repertorio...</option>
              {availableArrangements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({formatDuration(a.duration_seconds)})
                  {a.tags?.length ? ` · [${a.tags.join(", ")}]` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleAddSong()}
            disabled={!selectedSongId}
            className="comic comic-press flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Añadir al setlist
          </button>
        </div>
      </div>

      {/* Renderizado de Secciones por Pase */}
      <div className="space-y-6">
        {config.passes
          .filter((p) => activePassId === "all" || activePassId === p.id)
          .map((pass) => {
            const passItems = (items.data ?? []).filter((i) => {
              const assignedPass = itemPassMap[i.id] || config.passes[0]?.id || "p1";
              return assignedPass === pass.id;
            });

            const passSeconds = passItems.reduce(
              (acc, i) => acc + (i.arrangements?.duration_seconds ?? 0),
              0,
            );

            const passComp = formatTimeComparison(passSeconds, pass.target_minutes);

            return (
              <div key={pass.id} className="comic rounded-xl bg-card p-5 space-y-4">
                {/* Cabecera del Pase */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-2xl font-extrabold leading-none">{pass.name}</h3>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">
                      {passItems.length} temas · {passComp.addedText}
                      {pass.target_minutes > 0 ? ` de ${passComp.targetText} objetivo` : ""}
                    </p>
                  </div>

                  {pass.target_minutes > 0 && (
                    <span
                      className={`comic-sm rounded px-2.5 py-1 text-xs font-extrabold uppercase ${
                        passComp.status === "exact" || passComp.status === "exceeded"
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {passComp.diffText}
                    </span>
                  )}
                </div>

                {/* Barra de Progreso del Pase */}
                {pass.target_minutes > 0 && (
                  <div className="space-y-1">
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary border border-ink/20">
                      <div
                        className={`h-full transition-all duration-500 ${
                          passComp.status === "exceeded"
                            ? "bg-amber-500"
                            : passComp.percentage >= 100
                              ? "bg-emerald-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, passComp.percentage)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Lista de arreglos del pase con Drag & Drop */}
                {passItems.length === 0 ? (
                  <p className="comic-sm rounded-lg bg-background p-4 text-center text-xs font-bold text-muted-foreground">
                    Este pase aún no tiene canciones. Añade algunas desde el buscador arriba.
                  </p>
                ) : (
                  <SortableList
                    items={passItems}
                    onReorder={(reordered) => handleReorderPassItems(reordered)}
                    strategy="vertical"
                  >
                    {(item, index) => (
                      <SortableItem
                        key={item.id}
                        id={item.id}
                        handleOnly
                        className="comic grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-background p-3 my-2"
                      >
                        <span className="shrink-0 text-xl font-extrabold text-primary">
                          #{index + 1}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-lg font-extrabold leading-tight">
                            {item.arrangements?.title || "Cargando..."}
                          </p>
                          <p className="text-xs font-bold text-muted-foreground">
                            {formatDuration(item.arrangements?.duration_seconds ?? 0)}
                          </p>
                        </div>

                        {/* Mover a otro pase si hay varios */}
                        <div className="flex shrink-0 items-center gap-2 ml-auto">
                          {config.passes.length > 1 && (
                            <select
                              value={itemPassMap[item.id] || config.passes[0]?.id || "p1"}
                              onChange={(e) => handleMoveItemToPass(item.id, e.target.value)}
                              className="comic-sm rounded bg-card px-2 py-1 text-xs font-bold outline-none cursor-pointer"
                              title="Mover a otro pase"
                            >
                              {config.passes.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          )}

                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            aria-label="Quitar canción"
                            className="comic-sm comic-press rounded bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </SortableItem>
                    )}
                  </SortableList>
                )}
              </div>
            );
          })}
      </div>

      {/* Modal Editar Configuración de Setlist y Pases */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 p-4">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-2xl font-extrabold leading-none">Configurar Setlist</h2>
              <button onClick={() => setEditingConfig(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Nombre del show</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Fecha del evento</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">
                Duración objetivo total (minutos)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={editTargetMinutes}
                  onChange={(e) => setEditTargetMinutes(Number(e.target.value))}
                  className="comic-sm w-32 rounded-md bg-background px-3 py-2 text-base font-bold outline-none"
                />
                <span className="text-xs font-bold text-muted-foreground">
                  ({formatMinutesToHours(editTargetMinutes)})
                </span>
              </div>
            </div>

            {/* Pases */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase">Pases / Partes del show</label>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = `p${editPasses.length + 1}`;
                    setEditPasses([
                      ...editPasses,
                      { id: nextId, name: `Pase ${editPasses.length + 1}`, target_minutes: 30 },
                    ]);
                  }}
                  className="comic-sm rounded bg-accent px-2 py-0.5 text-xs font-bold uppercase"
                >
                  + Añadir pase
                </button>
              </div>

              {editPasses.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-2 rounded bg-background p-2">
                  <input
                    value={p.name}
                    onChange={(e) => {
                      const next = [...editPasses];
                      next[idx] = { ...next[idx]!, name: e.target.value };
                      setEditPasses(next);
                    }}
                    className="comic-sm min-w-0 flex-1 rounded bg-card px-2 py-1 text-xs font-bold outline-none"
                    placeholder="Nombre del pase"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={p.target_minutes}
                      onChange={(e) => {
                        const next = [...editPasses];
                        next[idx] = { ...next[idx]!, target_minutes: Number(e.target.value) };
                        setEditPasses(next);
                      }}
                      className="comic-sm w-16 rounded bg-card px-2 py-1 text-xs font-bold text-center outline-none"
                    />
                    <span className="text-[10px] font-bold text-muted-foreground">min</span>
                  </div>
                  {editPasses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditPasses(editPasses.filter((_, i) => i !== idx));
                      }}
                      className="comic-sm rounded bg-destructive/10 p-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveConfig}
              className="comic comic-press flex items-center justify-center gap-2 w-full rounded-md bg-primary py-3 font-extrabold uppercase text-primary-foreground"
            >
              <CheckCircle2 className="h-5 w-5" /> Guardar Cambios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
