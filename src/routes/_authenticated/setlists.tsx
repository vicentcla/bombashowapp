import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  X,
  Clock,
  Calendar,
  Layers,
  ListMusic,
  Settings,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Search,
  Music2,
  Sparkles,
  BookOpen,
  Coffee,
  Archive,
  ArchiveRestore,
  ChevronDown,
  LayoutTemplate,
  Undo2,
  Lightbulb,
  Save,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  MeasuringStrategy,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useArrangements,
  useSetlists,
  useSetlistItems,
  useInvalidate,
  useLyrics,
  useReorder,
  type Arrangement,
  type Lyric,
} from "@/lib/queries";
import {
  durationInputToSeconds,
  formatDuration,
  formatDurationInput,
  formatLongDuration,
  formatMinutesToHours,
  formatTimeComparison,
  normalize,
} from "@/lib/format";
import { SortableList, SortableItem } from "@/components/SortableList";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/setlists")({
  validateSearch: (search: Record<string, unknown>) => ({
    open: typeof search["open"] === "string" ? search["open"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Setlists — La Bomba Show" },
      {
        name: "description",
        content:
          "Organiza el repertorio en pases con duración objetivo y seguimiento en tiempo real.",
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

// Un descanso es una sección independiente entre pases (sin pass_id)
export type BreakItem = {
  id: string;
  minutes: number;
  title?: string;
};

// section_order lista IDs de pases y descansos en el orden que deben aparecer en el timeline
export type SetlistProposal = {
  id: string;
  setlist_id: string;
  setlist_name: string;
  arrangement_id: string; // solo para kind="single_song"
  arrangement_title: string; // solo para kind="single_song"
  pass_id: string; // solo para kind="single_song"
  pass_name: string; // solo para kind="single_song"
  user_id: string;
  user_name: string;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  kind?: "single_song" | "bulk_edit"; // default "single_song" para compatibilidad
  // Solo para kind="bulk_edit"
  bulk_items?: {
    arrangement_id: string | null;
    pass_id: string;
    position: number;
    title: string;
    duration_seconds: number;
    manual_title?: string | null;
    manual_duration_seconds?: number | null;
  }[];
};

export type SetlistNotesConfig = {
  target_minutes: number;
  passes: PassConfig[];
  item_pass_map: Record<string, string>; // item_id -> pass_id
  breaks?: BreakItem[];
  section_order?: string[]; // ordered IDs: pass IDs and break IDs interleaved
  notes_text?: string;
  archived?: boolean;
  proposals?: SetlistProposal[];
};

export function parseSetlistNotes(notes: string | null): SetlistNotesConfig {
  if (!notes) {
    return {
      target_minutes: 0,
      passes: [{ id: "p1", name: "Pase único", target_minutes: 0 }],
      item_pass_map: {},
      breaks: [],
      section_order: ["p1"],
    };
  }
  try {
    const parsed = JSON.parse(notes) as {
      target_minutes?: number;
      passes?: unknown[];
      item_pass_map?: Record<string, unknown>;
      breaks?: unknown[];
      section_order?: unknown[];
      proposals?: unknown[];
      notes_text?: unknown;
      archived?: unknown;
    };
    if (parsed && typeof parsed === "object") {
      const target_minutes = Number(parsed.target_minutes) || 0;
      const passes =
        Array.isArray(parsed.passes) && parsed.passes.length > 0
          ? parsed.passes.map((p, i) => {
              const rec = p as Record<string, unknown> | null;
              return {
                id: String(rec?.["id"] || `p${i + 1}`),
                name: String(rec?.["name"] || `Pase ${i + 1}`),
                target_minutes: Number(rec?.["target_minutes"]) || 0,
              };
            })
          : [{ id: "p1", name: "Pase único", target_minutes }];
      const item_pass_map =
        typeof parsed.item_pass_map === "object" && parsed.item_pass_map
          ? (parsed.item_pass_map as Record<string, string>)
          : {};
      // Breaks: parse without pass_id (top-level sections)
      const breaks: BreakItem[] = Array.isArray(parsed.breaks)
        ? parsed.breaks.map((b) => {
            const rec = b as Record<string, unknown> | null;
            return {
              id: String(rec?.["id"] || `b_${Math.random()}`),
              minutes: Number(rec?.["minutes"]) || 15,
              title: typeof rec?.["title"] === "string" ? rec["title"] : "Descanso",
            };
          })
        : [];
      // section_order: if stored, use it; else derive from passes (backward compat)
      const rawOrder: string[] =
        Array.isArray(parsed.section_order) && parsed.section_order.length > 0
          ? (parsed.section_order as string[])
          : passes.map((p) => p.id);

      // Ensure all pass IDs are present in section_order
      passes.forEach((p) => {
        if (!rawOrder.includes(p.id)) rawOrder.push(p.id);
      });
      // Ensure all break IDs are present in section_order
      breaks.forEach((b) => {
        if (!rawOrder.includes(b.id)) rawOrder.push(b.id);
      });

      const proposals: SetlistProposal[] = Array.isArray(parsed.proposals)
        ? (parsed.proposals as SetlistProposal[])
        : [];

      return {
        target_minutes,
        passes,
        item_pass_map,
        breaks,
        section_order: rawOrder,
        notes_text: typeof parsed.notes_text === "string" ? parsed.notes_text : "",
        archived: parsed.archived === true,
        proposals,
      };
    }
  } catch {
    // Si no es un JSON válido
  }
  return {
    target_minutes: 0,
    passes: [{ id: "p1", name: "Pase único", target_minutes: 0 }],
    item_pass_map: {},
    breaks: [],
    section_order: ["p1"],
    notes_text: notes,
    archived: false,
    proposals: [],
  };
}

export function serializeSetlistNotes(config: SetlistNotesConfig): string {
  return JSON.stringify(config);
}

// ─── Modo propuesta (copia virtual para no-admins) ──────────────────────────────

// Un item virtual representa una canción del setlist que solo existe en el buffer
// de propuesta del cliente hasta que un admin la aprueba.
export type VirtualItem = {
  id: string;
  arrangement_id: string | null;
  position: number;
  pass_id: string;
  arrangements: Arrangement | null;
  manual_title: string | null;
  manual_duration_seconds: number | null;
};

// Forma común de item para el renderizado (real desde la BD o virtual).
export type DisplayItem = {
  id: string;
  arrangement_id: string | null;
  position: number;
  arrangements: Arrangement | null;
  manual_title: string | null;
  manual_duration_seconds: number | null;
};

/** Título visible de un item (canción manual o arreglo). */
export function itemTitleOf(item: {
  arrangements: Arrangement | null;
  manual_title?: string | null;
}): string {
  return item.manual_title?.trim() || item.arrangements?.title || "";
}

/** Duración en segundos de un item (canción manual o arreglo). */
export function itemDurationOf(item: {
  arrangements: Arrangement | null;
  manual_duration_seconds?: number | null;
}): number {
  return item.manual_duration_seconds ?? item.arrangements?.duration_seconds ?? 0;
}

/** True si el item es una canción fuera de repertorio (sin arreglo vinculado). */
export function isManualItem(item: { arrangement_id: string | null }): boolean {
  return !item.arrangement_id;
}

/** Recalcula posiciones globales 1..n siguiendo el orden de section_order por pase. */
export function renumberVirtualItems(
  items: VirtualItem[],
  passMap: Record<string, string>,
  sectionOrder: string[],
  fallbackPass: string,
  passOverrides?: Record<string, string[]>,
): VirtualItem[] {
  const byPass = new Map<string, VirtualItem[]>();
  for (const it of items) {
    const pass = passMap[it.id] || fallbackPass;
    const arr = byPass.get(pass) ?? [];
    arr.push(it);
    byPass.set(pass, arr);
  }
  const consumed = new Set<string>();
  let n = 1;
  const out: VirtualItem[] = [];
  const emit = (it: VirtualItem) => {
    out.push({ ...it, position: n++ });
  };
  for (const sectionId of sectionOrder) {
    const overridden = passOverrides?.[sectionId];
    if (overridden) {
      for (const id of overridden) {
        const it = items.find((i) => i.id === id);
        if (it) emit(it);
      }
      consumed.add(sectionId);
      const rest = (byPass.get(sectionId) ?? []).filter((i) => !overridden.includes(i.id));
      for (const it of rest) emit(it);
    } else {
      consumed.add(sectionId);
      for (const it of byPass.get(sectionId) ?? []) emit(it);
    }
  }
  for (const [passId, arr] of byPass) {
    if (consumed.has(passId)) continue;
    for (const it of arr) emit(it);
  }
  return out;
}

// ─── Componente Principal SetlistsPage ──────────────────────────────────────────

function SetlistsPage() {
  const setlists = useSetlists();
  const invalidate = useInvalidate();
  const reorder = useReorder("setlists");
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(search.open ?? null);
  const [selectedToConfig, setSelectedToConfig] = useState(false);

  function handleReorder(newItems: { id: string }[]) {
    reorder.mutate(newItems.map((s) => s.id));
  }

  function openSetlist(id: string) {
    setSelected(id);
    navigate({ to: "/setlists", search: { open: id } });
  }

  function closeSetlist() {
    setSelected(null);
    setSelectedToConfig(false);
    navigate({ to: "/setlists", search: { open: undefined } });
  }
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [copyFromSearch, setCopyFromSearch] = useState("");

  // Sensors para drag and drop en modal de creación
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // Formulario nuevo setlist
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(90);

  const [createPasses, setCreatePasses] = useState<PassConfig[]>([
    { id: "p1", name: "Pase 1", target_minutes: 45 },
    { id: "p2", name: "Pase 2", target_minutes: 45 },
  ]);
  const [createBreaks, setCreateBreaks] = useState<BreakItem[]>([]);
  const [createSectionOrder, setCreateSectionOrder] = useState<string[]>(["p1", "p2"]);

  async function createSetlist() {
    if (!name.trim()) {
      toast.error("Por favor introduce un nombre para el setlist");
      return;
    }

    const passIds = new Set(createPasses.map((p) => p.id));
    const breakIds = new Set(createBreaks.map((b) => b.id));
    const cleanedOrder = createSectionOrder.filter((id) => passIds.has(id) || breakIds.has(id));
    createPasses.forEach((p) => {
      if (!cleanedOrder.includes(p.id)) cleanedOrder.push(p.id);
    });
    createBreaks.forEach((b) => {
      if (!cleanedOrder.includes(b.id)) cleanedOrder.push(b.id);
    });

    const config: SetlistNotesConfig = {
      target_minutes: targetMinutes,
      passes: createPasses,
      breaks: createBreaks,
      section_order: cleanedOrder,
      item_pass_map: {},
      archived: false,
    };

    const { data, error } = await supabase
      .from("setlists")
      .insert({
        name: name.trim(),
        event_date: date || null,
        notes: serializeSetlistNotes(config),
        sort_order: 0,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setName("");
    setDate("");
    setCreatePasses([
      { id: "p1", name: "Pase 1", target_minutes: 45 },
      { id: "p2", name: "Pase 2", target_minutes: 45 },
    ]);
    setCreateBreaks([]);
    setCreateSectionOrder(["p1", "p2"]);
    setCreating(false);
    invalidate("setlists");
    openSetlist(data.id);
    toast.success("Setlist creado correctamente");
  }

  // Crear desde plantilla (2 pases sin configuración)
  async function createFromTemplate() {
    setShowNewMenu(false);
    const ts = Date.now();
    const config: SetlistNotesConfig = {
      target_minutes: 90,
      passes: [
        { id: `p1_${ts}`, name: "Pase 1", target_minutes: 45 },
        { id: `p2_${ts}`, name: "Pase 2", target_minutes: 45 },
      ],
      breaks: [],
      section_order: [`p1_${ts}`, `p2_${ts}`],
      item_pass_map: {},
      archived: false,
    };

    const { data, error } = await supabase
      .from("setlists")
      .insert({
        name: "Plantilla 2 pases",
        event_date: null,
        notes: serializeSetlistNotes(config),
        sort_order: 0,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("setlists");
    openSetlist(data.id);
    toast.success("Plantilla de 2 pases creada");
  }

  type DeletedSetlistBackup = {
    setlist: {
      id: string;
      name: string;
      event_date: string | null;
      notes: string | null;
      sort_order: number;
    };
    items: {
      id: string;
      setlist_id: string;
      arrangement_id: string | null;
      position: number;
      manual_title: string | null;
      manual_duration_seconds: number | null;
    }[];
  };

  const [lastDeletedSetlist, setLastDeletedSetlist] = useState<DeletedSetlistBackup | null>(null);

  // Crear copia exacta de un setlist existente (pases, tiempos, descansos Y canciones)
  async function createFromSetlist(source: { id: string; name: string; notes: string | null }) {
    setShowCopyFrom(false);
    setShowNewMenu(false);

    const sourceConfig = parseSetlistNotes(source.notes);

    // 1. Reasignar IDs frescos a pases y descansos para no colisionar
    const ts = Date.now();
    const passIdMap: Record<string, string> = {};
    const newPasses: PassConfig[] = sourceConfig.passes.map((p, i) => {
      const newId = `p_${ts}_${i}`;
      passIdMap[p.id] = newId;
      return { ...p, id: newId };
    });
    const breakIdMap: Record<string, string> = {};
    const newBreaks: BreakItem[] = (sourceConfig.breaks ?? []).map((b, i) => {
      const newId = `b_${ts}_${i}`;
      breakIdMap[b.id] = newId;
      return { ...b, id: newId };
    });
    const newOrder = (sourceConfig.section_order ?? sourceConfig.passes.map((p) => p.id)).map(
      (id) => passIdMap[id] ?? breakIdMap[id] ?? id,
    );

    // 2. Obtener todas las canciones (items) del setlist de origen
    const { data: sourceItems } = await supabase
      .from("setlist_items")
      .select("*")
      .eq("setlist_id", source.id)
      .order("position", { ascending: true });

    // 3. Crear el nuevo setlist en BD
    const initialConfig: SetlistNotesConfig = {
      ...sourceConfig,
      passes: newPasses,
      breaks: newBreaks,
      section_order: newOrder,
      item_pass_map: {},
      archived: false,
    };

    const { data: newSetlist, error: createErr } = await supabase
      .from("setlists")
      .insert({
        name: "-",
        event_date: null,
        notes: serializeSetlistNotes(initialConfig),
        sort_order: 0,
      })
      .select("id")
      .single();

    if (createErr || !newSetlist) {
      toast.error(createErr?.message || "Error al crear el setlist");
      return;
    }

    // 4. Copiar los setlist_items e igualar las asignaciones a pases
    const newItemPassMap: Record<string, string> = {};

    if (sourceItems && sourceItems.length > 0) {
      for (const item of sourceItems) {
        const { data: newItem } = await supabase
          .from("setlist_items")
          .insert({
            setlist_id: newSetlist.id,
            arrangement_id: item.arrangement_id,
            position: item.position,
            manual_title: item.manual_title,
            manual_duration_seconds: item.manual_duration_seconds,
          })
          .select("id")
          .single();

        if (newItem) {
          const oldPassId = sourceConfig.item_pass_map[item.id];
          if (oldPassId && passIdMap[oldPassId]) {
            newItemPassMap[newItem.id] = passIdMap[oldPassId];
          } else if (newPasses[0]?.id) {
            newItemPassMap[newItem.id] = newPasses[0].id;
          }
        }
      }
    }

    // 5. Guardar el item_pass_map definitivo en las notas del nuevo setlist
    const finalConfig: SetlistNotesConfig = {
      ...initialConfig,
      item_pass_map: newItemPassMap,
    };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(finalConfig) })
      .eq("id", newSetlist.id);

    invalidate("setlists", "setlist_items");
    setSelectedToConfig(true);
    openSetlist(newSetlist.id);
    toast.success(`Copia completa de "${source.name}" creada`);
  }

  async function removeSetlist(id: string, setlistName: string) {
    if (!confirm(`¿Eliminar el setlist "${setlistName}"?`)) return;

    // Guardar copia de seguridad antes de borrar
    const { data: sData } = await supabase.from("setlists").select("*").eq("id", id).single();
    const { data: iData } = await supabase.from("setlist_items").select("*").eq("setlist_id", id);

    if (sData) {
      const backup: DeletedSetlistBackup = {
        setlist: sData,
        items:
          (iData as {
            id: string;
            setlist_id: string;
            arrangement_id: string | null;
            position: number;
            manual_title: string | null;
            manual_duration_seconds: number | null;
          }[]) ?? [],
      };
      setLastDeletedSetlist(backup);

      const { error } = await supabase.from("setlists").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }

      if (selected === id) closeSetlist();
      invalidate("setlists", "setlist_items");

      toast(`Setlist "${setlistName}" eliminado`, {
        action: {
          label: "Deshacer",
          onClick: () => restoreSetlist(backup),
        },
        duration: 10000,
      });
    }
  }

  async function restoreSetlist(backup?: DeletedSetlistBackup | null) {
    const target = backup || lastDeletedSetlist;
    if (!target) return;

    const { error: sErr } = await supabase.from("setlists").insert({
      id: target.setlist.id,
      name: target.setlist.name,
      event_date: target.setlist.event_date,
      notes: target.setlist.notes,
      sort_order: target.setlist.sort_order,
    });

    if (sErr) {
      toast.error("Error al restaurar: " + sErr.message);
      return;
    }

    if (target.items.length > 0) {
      const itemsToInsert = target.items.map((item) => ({
        id: item.id,
        setlist_id: item.setlist_id,
        arrangement_id: item.arrangement_id,
        position: item.position,
        manual_title: item.manual_title,
        manual_duration_seconds: item.manual_duration_seconds,
      }));
      await supabase.from("setlist_items").insert(itemsToInsert);
    }

    setLastDeletedSetlist(null);
    invalidate("setlists", "setlist_items");
    toast.success(`Setlist "${target.setlist.name}" restaurado`);
  }

  async function toggleArchive(
    setlist: { id: string; notes: string | null },
    currentConfig: SetlistNotesConfig,
  ) {
    const newArchived = !currentConfig.archived;
    const updatedConfig: SetlistNotesConfig = { ...currentConfig, archived: newArchived };
    const { error } = await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlist.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("setlists");
    toast.success(newArchived ? "Setlist archivado" : "Setlist restaurado");
  }

  if (selected) {
    return (
      <SetlistDetail
        setlistId={selected}
        onBack={closeSetlist}
        {...(selectedToConfig ? { initialTab: "config" } : {})}
      />
    );
  }

  const allSetlists = setlists.data ?? [];
  const visibleSetlists = allSetlists.filter((s) => {
    const cfg = parseSetlistNotes(s.notes);
    return showArchived ? cfg.archived === true : !cfg.archived;
  });
  const archivedCount = allSetlists.filter(
    (s) => parseSetlistNotes(s.notes).archived === true,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ListMusic className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-extrabold leading-none">Setlists</h1>
            <p className="text-xs font-bold text-muted-foreground">
              Planifica pases, compara duraciones y controla los tiempos en vivo
            </p>
          </div>
        </div>

        {/* Controles de cabecera: tab Archivados + deshacer + botón Nuevo con desplegable */}
        <div className="flex items-center gap-2">
          {lastDeletedSetlist && (
            <button
              onClick={() => restoreSetlist()}
              className="comic-sm flex items-center gap-1 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1 text-[11px] font-bold transition-colors border border-border/50"
              title="Restaurar el último setlist eliminado"
            >
              <Undo2 className="h-3 w-3" /> Deshacer
            </button>
          )}

          {/* Tab Archivados */}
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`comic-sm comic-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold uppercase transition-colors ${
              showArchived
                ? "bg-amber-500 text-white"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            Archivados
            {archivedCount > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                  showArchived ? "bg-white/20" : "bg-primary text-primary-foreground"
                }`}
              >
                {archivedCount}
              </span>
            )}
          </button>

          {/* Botón Nuevo con desplegable */}
          <div className="relative">
            <div className="flex">
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  setCreating(true);
                }}
                className="comic comic-press flex items-center gap-2 rounded-l-lg bg-primary px-4 py-2.5 text-sm font-extrabold uppercase text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Nuevo
              </button>
              <button
                onClick={() => setShowNewMenu((v) => !v)}
                className="comic comic-press flex items-center rounded-r-lg border-l border-primary-foreground/20 bg-primary px-2 py-2.5 text-primary-foreground"
                aria-label="Más opciones"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {showNewMenu && (
              <>
                {/* Overlay para cerrar */}
                <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl bg-card comic shadow-lg border border-ink/10 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setCreating(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-extrabold uppercase hover:bg-accent transition-colors text-left"
                  >
                    <Plus className="h-4 w-4 text-primary" />
                    Nuevo Setlist
                  </button>
                  <button
                    onClick={createFromTemplate}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-extrabold uppercase hover:bg-accent transition-colors text-left border-t border-ink/10"
                  >
                    <LayoutTemplate className="h-4 w-4 text-primary" />
                    Plantilla 2 pases
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setShowCopyFrom(true);
                      setCopyFromSearch("");
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-extrabold uppercase hover:bg-accent transition-colors text-left border-t border-ink/10"
                  >
                    <Archive className="h-4 w-4 text-primary" />A partir de...
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab indicator */}
      {showArchived && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
          <Archive className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300">
            Mostrando setlists archivados
          </span>
          <button
            onClick={() => setShowArchived(false)}
            className="ml-auto text-[11px] font-extrabold text-amber-700 dark:text-amber-300 underline"
          >
            Ver activos
          </button>
        </div>
      )}

      {visibleSetlists.length === 0 && (
        <div className="comic rounded-xl bg-card p-8 text-center">
          {showArchived ? (
            <>
              <Archive className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-lg font-bold">No tienes setlists archivados.</p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        <SortableList items={visibleSetlists} onReorder={handleReorder} strategy="vertical">
          {(s) => {
            const config = parseSetlistNotes(s.notes);
            return (
              <SortableItem
                key={s.id}
                id={s.id}
                handleOnly
                className="comic grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl bg-card p-4"
              >
                <SetlistCard
                  setlist={s}
                  config={config}
                  onSelect={() => openSetlist(s.id)}
                  onDelete={() => removeSetlist(s.id, s.name)}
                  onArchive={() => toggleArchive(s, config)}
                />
              </SortableItem>
            );
          }}
        </SortableList>
      </div>

      {/* Modal "A partir de..." – copiar un setlist existente */}
      {showCopyFrom && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pb-10">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 space-y-4 mt-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-2xl font-extrabold leading-none">A partir de...</h2>
              <button onClick={() => setShowCopyFrom(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground font-medium">
              Selecciona un setlist para copiar su estructura (pases, descansos y duración). Las
              canciones no se copian y el nombre quedará vacío.
            </p>

            {/* Buscador */}
            <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 border border-ink/10">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={copyFromSearch}
                onChange={(e) => setCopyFromSearch(e.target.value)}
                placeholder="Buscar setlist..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                autoFocus
              />
              {copyFromSearch && (
                <button
                  onClick={() => setCopyFromSearch("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {(() => {
              const all = setlists.data ?? [];
              const q = copyFromSearch.toLowerCase().trim();
              const filtered = q ? all.filter((s) => s.name.toLowerCase().includes(q)) : all;
              const activeItems = filtered.filter((s) => !parseSetlistNotes(s.notes).archived);
              const archivedItems = filtered.filter(
                (s) => parseSetlistNotes(s.notes).archived === true,
              );

              const renderItem = (s: {
                id: string;
                name: string;
                event_date: string | null;
                notes: string | null;
              }) => {
                const cfg = parseSetlistNotes(s.notes);
                return (
                  <button
                    key={s.id}
                    onClick={() => createFromSetlist(s)}
                    className="w-full text-left rounded-lg border border-ink/10 bg-background px-4 py-3 hover:border-primary/60 hover:bg-primary/5 transition-all group"
                  >
                    <p className="font-extrabold text-sm group-hover:text-primary transition-colors">
                      {s.name || <span className="italic text-muted-foreground">(sin nombre)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {cfg.passes.length} {cfg.passes.length === 1 ? "pase" : "pases"}
                      {(cfg.breaks?.length ?? 0) > 0 &&
                        ` · ${cfg.breaks!.length} descanso${cfg.breaks!.length > 1 ? "s" : ""}`}
                      {cfg.target_minutes > 0 && ` · ${cfg.target_minutes} min objetivo`}
                      {s.event_date &&
                        ` · ${new Date(s.event_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`}
                    </p>
                  </button>
                );
              };

              return (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {activeItems.length === 0 && archivedItems.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No hay setlists que coincidan.
                    </p>
                  )}

                  {activeItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider px-1">
                        Activos
                      </p>
                      {activeItems.map(renderItem)}
                    </div>
                  )}

                  {archivedItems.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider px-1 flex items-center gap-1">
                        <Archive className="h-3 w-3" /> Archivados
                      </p>
                      {archivedItems.map(renderItem)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Nuevo Setlist */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pb-10">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 space-y-4 mt-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-2xl font-extrabold leading-none">Nuevo setlist</h2>
              <button onClick={() => setCreating(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">
                Nombre del evento / show
              </label>
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
                className="comic-sm w-full min-w-0 rounded-md bg-background px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">
                Duración objetivo total (minutos)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  max={600}
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="comic-sm w-32 rounded-md bg-background px-3 py-2 text-base font-bold outline-none"
                />
                <span className="text-xs font-bold text-muted-foreground">
                  ({formatMinutesToHours(targetMinutes)})
                </span>
              </div>
            </div>

            {/* Estructura unificada y reordenable de pases y descansos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Estructura y Orden del Show
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const passNum = createPasses.length + 1;
                      const newPass: PassConfig = {
                        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                        name: `Pase ${passNum}`,
                        target_minutes: 30,
                      };
                      setCreatePasses([...createPasses, newPass]);
                      setCreateSectionOrder([...createSectionOrder, newPass.id]);
                    }}
                    className="comic-sm rounded bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 text-xs font-extrabold uppercase border border-primary/30 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Pase
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newBreak: BreakItem = {
                        id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                        minutes: 15,
                        title: "Descanso",
                      };
                      setCreateBreaks([...createBreaks, newBreak]);
                      setCreateSectionOrder([...createSectionOrder, newBreak.id]);
                    }}
                    className="comic-sm rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 px-2 py-1 text-xs font-extrabold uppercase border border-amber-500/30 flex items-center gap-1"
                  >
                    <Coffee className="h-3 w-3" /> Descanso
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground font-bold">
                Usa los botones <span className="font-mono">▲</span> y{" "}
                <span className="font-mono">▼</span> para ordenar la secuencia.
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {createSectionOrder.map((sectionId, idx) => {
                  const pass = createPasses.find((p) => p.id === sectionId);
                  const breakItem = createBreaks.find((b) => b.id === sectionId);
                  const isPass = !!pass;
                  if (!pass && !breakItem) return null;

                  return (
                    <ConfigSectionRow
                      key={sectionId}
                      index={idx}
                      total={createSectionOrder.length}
                      id={sectionId}
                      isPass={isPass}
                      {...(pass ? { pass } : {})}
                      {...(breakItem ? { breakItem } : {})}
                      onMoveUp={() => {
                        if (idx > 0) {
                          const next = [...createSectionOrder];
                          const [item] = next.splice(idx, 1);
                          if (item) next.splice(idx - 1, 0, item);
                          setCreateSectionOrder(next);
                        }
                      }}
                      onMoveDown={() => {
                        if (idx < createSectionOrder.length - 1) {
                          const next = [...createSectionOrder];
                          const [item] = next.splice(idx, 1);
                          if (item) next.splice(idx + 1, 0, item);
                          setCreateSectionOrder(next);
                        }
                      }}
                      onUpdatePass={(updated) => {
                        setCreatePasses(
                          createPasses.map((p) => (p.id === updated.id ? updated : p)),
                        );
                      }}
                      onUpdateBreak={(updated) => {
                        setCreateBreaks(
                          createBreaks.map((b) => (b.id === updated.id ? updated : b)),
                        );
                      }}
                      onRemovePass={() => {
                        setCreatePasses(createPasses.filter((p) => p.id !== sectionId));
                        setCreateSectionOrder(createSectionOrder.filter((id) => id !== sectionId));
                      }}
                      onRemoveBreak={() => {
                        setCreateBreaks(createBreaks.filter((b) => b.id !== sectionId));
                        setCreateSectionOrder(createSectionOrder.filter((id) => id !== sectionId));
                      }}
                      canRemovePass={createPasses.length > 1}
                    />
                  );
                })}
              </div>
            </div>

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
  onArchive,
}: {
  setlist: { id: string; name: string; event_date: string | null };
  config: SetlistNotesConfig;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const items = useSetlistItems(setlist.id);
  const totalSeconds = (items.data ?? []).reduce((acc, i) => acc + itemDurationOf(i), 0);

  const comp = formatTimeComparison(totalSeconds, config.target_minutes);

  return (
    <div className="flex min-w-0 flex-col justify-between gap-3">
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
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón Archivar / Restaurar */}
            <button
              onClick={onArchive}
              aria-label={config.archived ? "Restaurar setlist" : "Archivar setlist"}
              className="comic-sm comic-press rounded-md bg-amber-500/10 p-2 text-amber-600 hover:bg-amber-500 hover:text-white transition-colors"
              title={config.archived ? "Restaurar setlist" : "Archivar setlist"}
            >
              {config.archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </button>
            {/* Botón Eliminar */}
            <button
              onClick={onDelete}
              aria-label="Eliminar setlist"
              className="comic-sm comic-press rounded-md bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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

// ─── Droppable zone para un pase (cross-container DnD) ─────────────────────────
function PassDropZone({
  passId,
  children,
  className = "",
}: {
  passId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: passId });
  return (
    <div
      ref={setNodeRef}
      className={`${className} rounded-xl transition-colors duration-150 ${isOver ? "ring-2 ring-primary bg-primary/10" : ""}`}
    >
      {children}
    </div>
  );
}

// ─── Item arrastrable dentro del pase (con handle) ──────────────────────────────
function DraggableItem({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${
        isDragging
          ? "opacity-60 outline-2 outline-dashed outline-offset-2 outline-primary bg-primary/10 [&>*]:invisible"
          : ""
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Arrastrar para mover"
        className="-m-1 cursor-grab touch-none rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing active:bg-primary/15 active:text-primary"
        style={{ touchAction: "none" }}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      {children}
    </div>
  );
}

// ─── Modal de visualización de letra (igual que en letras.tsx) ──────────────────
function SetlistLyricModal({ lyric, onClose }: { lyric: Lyric; onClose: () => void }) {
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
      </div>
    </div>
  );
}

// ─── Modal para Selección Múltiple de Canciones a un Pase ────────────────────
function AddSongsToPassModal({
  passName,
  arrangements,
  onClose,
  onAdd,
  onAddManual,
}: {
  passName: string;
  arrangements: Arrangement[];
  onClose: () => void;
  onAdd: (songIds: string[]) => Promise<void>;
  onAddManual: (title: string, durationSeconds: number) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [duration, setDuration] = useState("");

  const allTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of arrangements) {
      for (const t of a.tags ?? []) {
        const norm = normalize(t);
        if (norm && !map.has(norm)) {
          map.set(norm, t);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [arrangements]);

  const filtered = useMemo(() => {
    let list = arrangements.filter(
      (a) => !tag || (a.tags ?? []).some((t) => normalize(t) === normalize(tag)),
    );
    if (search.trim()) {
      const q = normalize(search.trim());
      list = list.filter(
        (a) =>
          normalize(a.title).includes(q) || (a.tags ?? []).some((t) => normalize(t).includes(q)),
      );
    }
    return list;
  }, [arrangements, search, tag]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    const filteredIds = filtered.map((a) => a.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  }

  async function handleConfirm() {
    if (!selectedIds.length) return;
    setBusy(true);
    await onAdd(selectedIds);
    setBusy(false);
    onClose();
  }

  async function handleCreateManual() {
    const title = creating?.trim();
    if (!title) return;
    const durationSeconds = durationInputToSeconds(duration);
    setBusy(true);
    await onAddManual(title, durationSeconds);
    setBusy(false);
    onClose();
  }

  function startCreate() {
    setCreating(search.trim());
    setDuration("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="comic flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-card p-4 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h2 className="text-2xl font-extrabold leading-none">Añadir canciones</h2>
            <p className="text-xs font-bold text-muted-foreground mt-1">
              Asignar directamente a <span className="text-primary">{passName}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
          <Search className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Crear o buscar por título o etiqueta…"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>

        {/* Filtros por etiqueta */}
        {creating === null && allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            <button
              type="button"
              onClick={() => setTag("")}
              className={`comic-sm rounded px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                tag === "" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              Todas ({arrangements.length})
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t === tag ? "" : t)}
                className={`comic-sm rounded px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                  tag === t ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Selección múltiple rápida */}
        {creating === null && (
          <div className="flex items-center justify-between text-xs font-bold px-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-primary hover:underline"
            >
              {filtered.length > 0 && filtered.every((a) => selectedIds.includes(a.id))
                ? "Deseleccionar todas"
                : "Seleccionar todas las filtradas"}
            </button>
            <span className="text-muted-foreground">{selectedIds.length} seleccionadas</span>
          </div>
        )}

        {/* Lista con Checkboxes / crear canción manual */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-72 border rounded-lg p-2 bg-background">
          {creating !== null ? (
            <div className="space-y-2 p-1">
              <div>
                <label className="mb-0.5 block text-xs font-bold uppercase">
                  Nombre de la canción
                </label>
                <input
                  value={creating}
                  onChange={(e) => setCreating(e.target.value)}
                  maxLength={120}
                  autoFocus
                  className="comic-sm w-full rounded-md border border-border bg-background px-3 py-1.5 text-base outline-none"
                />
              </div>

              <label className="block text-xs font-bold uppercase">
                Duración (mm:ss)
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0:00"
                  value={formatDurationInput(duration)}
                  onChange={(e) => setDuration(e.target.value)}
                  className="comic-sm mt-0.5 w-full rounded-md border border-border bg-background px-3 py-1.5 text-base outline-none"
                />
              </label>

              <p className="text-xs font-bold text-muted-foreground">
                Duración: {formatDuration(durationInputToSeconds(duration))}
              </p>

              <button
                onClick={handleCreateManual}
                disabled={busy || !creating.trim()}
                className="comic comic-press flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-extrabold uppercase text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-5 w-5" /> Crear y añadir a {passName}
              </button>
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="comic-sm w-full rounded-md py-1.5 text-xs font-extrabold uppercase text-muted-foreground hover:bg-muted/60"
              >
                Volver a la búsqueda
              </button>
            </div>
          ) : filtered.length === 0 ? (
            search.trim() ? (
              <button
                type="button"
                onClick={startCreate}
                className="comic-sm flex w-full items-center gap-3 rounded-lg bg-primary/10 p-3 text-left font-extrabold text-primary transition-colors hover:bg-primary/20"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </span>
                <span>
                  Crear <span>"{search.trim()}"</span>…
                </span>
              </button>
            ) : (
              <p className="p-4 text-center text-xs font-bold text-muted-foreground">
                Escribe para buscar o crear una canción.
              </p>
            )
          ) : (
            filtered.map((a) => {
              const isChecked = selectedIds.includes(a.id);
              return (
                <div
                  key={a.id}
                  onClick={() => toggleSelect(a.id)}
                  className={`comic-sm flex items-center justify-between gap-3 rounded-lg p-2.5 cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-primary/15 border-primary/50 border"
                      : "bg-card hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-5 w-5 shrink-0 rounded flex items-center justify-center border font-extrabold text-xs transition-colors ${
                        isChecked
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border bg-background"
                      }`}
                    >
                      {isChecked ? "✓" : ""}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold leading-tight">{a.title}</p>
                      {!!a.tags?.length && (
                        <p className="text-[10px] font-bold text-muted-foreground truncate">
                          {a.tags.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-bold font-mono text-muted-foreground">
                    {formatDuration(a.duration_seconds)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Botón Añadir */}
        {creating === null && (
          <button
            onClick={handleConfirm}
            disabled={!selectedIds.length || busy}
            className="comic comic-press flex items-center justify-center gap-2 w-full rounded-md bg-primary py-3 font-extrabold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Añadir {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} a {passName}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modal para Añadir Descanso (entre pases) ────────────────────────────────
function AddBreakModal({
  passes,
  sectionOrder,
  onClose,
  onAdd,
}: {
  passes: PassConfig[];
  sectionOrder: string[];
  onClose: () => void;
  onAdd: (minutes: number, afterSectionId: string, title?: string) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(15);
  const [title, setTitle] = useState("Descanso");
  const [busy, setBusy] = useState(false);

  // Filtrar pases que NO tienen ya un descanso inmediatamente después en sectionOrder
  const availablePasses = useMemo(() => {
    return passes.filter((p) => {
      const idx = sectionOrder.indexOf(p.id);
      if (idx === -1) return true;
      const nextId = sectionOrder[idx + 1];
      return !nextId || !nextId.startsWith("b_");
    });
  }, [passes, sectionOrder]);

  const [afterSectionId, setAfterSectionId] = useState(
    availablePasses.length > 0 ? availablePasses[0]!.id : "",
  );

  const presets = [5, 10, 15, 20, 30, 45];

  async function handleConfirm() {
    if (!afterSectionId) return;
    setBusy(true);
    await onAdd(minutes, afterSectionId, title);
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="comic w-full max-w-sm rounded-xl bg-card p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-2xl font-extrabold leading-none">Añadir descanso</h2>
            <p className="text-xs font-bold text-muted-foreground mt-1">
              Inserta una pausa entre pases
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {availablePasses.length === 0 ? (
          <div className="comic-sm rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-amber-900 dark:text-amber-200 text-xs font-extrabold text-center space-y-2">
            <p>Todos los pases ya tienen un descanso a continuación.</p>
            <p className="text-[11px] font-bold opacity-80">
              No se pueden colocar dos descansos juntos.
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Insertar después de</label>
              <select
                value={afterSectionId}
                onChange={(e) => setAfterSectionId(e.target.value)}
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none font-bold"
              >
                {availablePasses.map((pass) => (
                  <option key={pass.id} value={pass.id}>
                    {pass.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">Duración (minutos)</label>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {presets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinutes(m)}
                    className={`comic-sm py-2 rounded text-xs font-extrabold uppercase ${
                      minutes === m ? "bg-primary text-primary-foreground" : "bg-background"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base font-bold outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase font-extrabold">
                Título / Etiqueta
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descanso, Pausa bocata..."
                className="comic-sm w-full rounded-md bg-background px-3 py-2 text-base outline-none"
              />
            </div>

            <button
              onClick={handleConfirm}
              disabled={busy || minutes <= 0 || !afterSectionId}
              className="comic comic-press flex items-center justify-center gap-2 w-full rounded-md bg-amber-500 text-ink py-3 font-extrabold uppercase disabled:opacity-50"
            >
              <Coffee className="h-5 w-5" /> Añadir Descanso ({minutes} min)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Componente para cada sección (pase o descanso) reordenable en la configuración ───
function ConfigSectionRow({
  index,
  total,
  isPass,
  pass,
  breakItem,
  onMoveUp,
  onMoveDown,
  onUpdatePass,
  onUpdateBreak,
  onRemovePass,
  onRemoveBreak,
  canRemovePass,
}: {
  index: number;
  total: number;
  isPass: boolean;
  id: string;
  pass?: PassConfig;
  breakItem?: BreakItem;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdatePass: (updated: PassConfig) => void;
  onUpdateBreak: (updated: BreakItem) => void;
  onRemovePass: () => void;
  onRemoveBreak: () => void;
  canRemovePass: boolean;
}) {
  return (
    <div
      className={`comic-sm flex items-center gap-2 rounded-lg p-2.5 bg-background border transition-all ${
        isPass ? "border-primary/40 shadow-sm" : "border-amber-500/40 bg-amber-500/5 shadow-sm"
      }`}
    >
      {/* Botones de posición Arriba / Abajo */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="comic-sm rounded bg-accent/60 px-1 py-0.5 text-[10px] font-extrabold hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
          title="Mover arriba"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="comic-sm rounded bg-accent/60 px-1 py-0.5 text-[10px] font-extrabold hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
          title="Mover abajo"
        >
          ▼
        </button>
      </div>

      {/* Badge tipo */}
      <span
        className={`comic-sm rounded px-2 py-0.5 text-[10px] font-extrabold uppercase shrink-0 ${
          isPass
            ? "bg-primary text-primary-foreground"
            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
        }`}
      >
        {isPass ? "Pase" : "Descanso"}
      </span>

      {/* Inputs según tipo */}
      {isPass && pass && (
        <>
          <input
            value={pass.name}
            onChange={(e) => onUpdatePass({ ...pass, name: e.target.value })}
            placeholder="Nombre del pase"
            className="comic-sm min-w-0 flex-1 rounded bg-card px-2.5 py-1 text-xs font-bold outline-none border border-ink/10 focus:border-primary"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              value={pass.target_minutes}
              onChange={(e) => onUpdatePass({ ...pass, target_minutes: Number(e.target.value) })}
              className="comic-sm w-14 rounded bg-card px-2 py-1 text-xs font-bold text-center outline-none border border-ink/10 focus:border-primary"
            />
            <span className="text-[10px] font-bold text-muted-foreground">min</span>
          </div>
          {canRemovePass && (
            <button
              type="button"
              onClick={onRemovePass}
              className="comic-sm rounded bg-destructive/10 p-1 text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0 transition-colors"
              title="Eliminar pase"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}

      {!isPass && breakItem && (
        <>
          <input
            value={breakItem.title ?? "Descanso"}
            onChange={(e) => onUpdateBreak({ ...breakItem, title: e.target.value })}
            placeholder="Etiqueta"
            className="comic-sm min-w-0 flex-1 rounded bg-card px-2.5 py-1 text-xs font-bold outline-none border border-ink/10 focus:border-amber-500"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              max={180}
              value={breakItem.minutes}
              onChange={(e) => onUpdateBreak({ ...breakItem, minutes: Number(e.target.value) })}
              className="comic-sm w-14 rounded bg-card px-2 py-1 text-xs font-bold text-center outline-none border border-ink/10 focus:border-amber-500"
            />
            <span className="text-[10px] font-bold text-muted-foreground">min</span>
          </div>
          <button
            type="button"
            onClick={onRemoveBreak}
            className="comic-sm rounded bg-destructive/10 p-1 text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0 transition-colors"
            title="Eliminar descanso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function SetlistDetail({
  setlistId,
  onBack,
  initialTab,
}: {
  setlistId: string;
  onBack: () => void;
  initialTab?: "config";
}) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const setlists = useSetlists();
  const items = useSetlistItems(setlistId);
  const arrangements = useArrangements();
  const lyrics = useLyrics();
  const invalidate = useInvalidate();

  const setlist = setlists.data?.find((s) => s.id === setlistId);
  const config = useMemo(() => parseSetlistNotes(setlist?.notes ?? null), [setlist?.notes]);

  // Modal state para añadir canciones o descansos a un pase específico
  const [addingSongsPass, setAddingSongsPass] = useState<{ id: string; name: string } | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);

  // Confirmación de borrado de pase
  const [confirmDeletePassId, setConfirmDeletePassId] = useState<string | null>(null);
  // Tab activo de pases ("all" o el id del pase)
  const [activePassId, setActivePassId] = useState<string>("all");
  const [editingConfig, setEditingConfig] = useState(initialTab === "config");
  const [isEditingItems, setIsEditingItems] = useState(false);
  // Para el lyric modal en modo lectura
  const [activeLyric, setActiveLyric] = useState<Lyric | null>(null);
  // Para drag overlay (ID del item que se está arrastrando)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  // Modo propuesta para no-admins: bufferiza cambios sin guardar en DB
  const [isProposalMode, setIsProposalMode] = useState(false);
  const [proposalItems, setProposalItems] = useState<VirtualItem[]>([]);
  const [proposalPassMap, setProposalPassMap] = useState<Record<string, string>>({});
  const proposalStartRef = useRef<{ items: VirtualItem[]; passMap: Record<string, string> } | null>(
    null,
  );

  const fallbackPass = config.passes[0]?.id || "p1";
  const sectionOrder = config.section_order ?? config.passes.map((p) => p.id);

  // Items activos a mostrar: reales (admin/lectura) o virtuales (propuesta)
  const activeItems: DisplayItem[] = useMemo(
    () =>
      isProposalMode
        ? proposalItems.map((vi) => ({
            id: vi.id,
            arrangement_id: vi.arrangement_id,
            position: vi.position,
            arrangements: vi.arrangements ?? null,
            manual_title: vi.manual_title,
            manual_duration_seconds: vi.manual_duration_seconds,
          }))
        : (items.data ?? []),
    [isProposalMode, proposalItems, items.data],
  );
  const activePassMap = isProposalMode ? proposalPassMap : config.item_pass_map || {};

  // Formulario de edición de configuración
  const [editName, setEditName] = useState(setlist?.name || "");
  const [editDate, setEditDate] = useState(setlist?.event_date || "");
  const [editTargetMinutes, setEditTargetMinutes] = useState(config.target_minutes);
  const [editPasses, setEditPasses] = useState<PassConfig[]>(config.passes);
  const [editBreaks, setEditBreaks] = useState<BreakItem[]>(config.breaks ?? []);
  const [editSectionOrder, setEditSectionOrder] = useState<string[]>(
    config.section_order ?? [
      ...config.passes.map((p) => p.id),
      ...(config.breaks ?? []).map((b) => b.id),
    ],
  );

  // Sincronizar el formulario cuando el setlist/config se carga o actualiza desde Supabase
  useEffect(() => {
    if (setlist) {
      setEditName(setlist.name || "");
      setEditDate(setlist.event_date || "");
      setEditTargetMinutes(config.target_minutes);
      setEditPasses(config.passes);
      setEditBreaks(config.breaks ?? []);
      setEditSectionOrder(
        config.section_order ?? [
          ...config.passes.map((p) => p.id),
          ...(config.breaks ?? []).map((b) => b.id),
        ],
      );
    }
  }, [setlist, config]);

  // Mapeo de canción -> pase (del DB)
  const itemPassMap = config.item_pass_map || {};

  // Sensores DnD para cross-container
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  // Función para buscar la letra de un arreglo por su arrangement_id
  function findLyricForArrangement(arrangementId: string | null): Lyric | null {
    if (!arrangementId || !lyrics.data) return null;
    return lyrics.data.find((l) => l.arrangement_id === arrangementId) ?? null;
  }

  // Total acumulado general (canciones + descansos)
  const totalSecondsSongs = useMemo(
    () => activeItems.reduce((acc, i) => acc + itemDurationOf(i), 0),
    [activeItems],
  );
  const totalSecondsBreaks = useMemo(
    () => (config.breaks ?? []).reduce((acc, b) => acc + b.minutes * 60, 0),
    [config.breaks],
  );

  const overallComp = formatTimeComparison(
    totalSecondsSongs + totalSecondsBreaks,
    config.target_minutes,
  );

  // Eliminar un pase y todas sus canciones asignadas
  async function handleDeletePass(passId: string) {
    if (isProposalMode) return; // los cambios de estructura no van por propuesta
    const updatedPasses = config.passes.filter((p) => p.id !== passId);
    if (updatedPasses.length === 0) return; // siempre debe quedar al menos uno

    // Encontrar e eliminar todas las canciones pertenecientes a este pase
    const itemsToDelete = (items.data ?? [])
      .filter((i) => (itemPassMap[i.id] || config.passes[0]?.id) === passId)
      .map((i) => i.id);

    if (itemsToDelete.length > 0) {
      const { error: delError } = await supabase
        .from("setlist_items")
        .delete()
        .in("id", itemsToDelete);

      if (delError) {
        toast.error(delError.message);
        return;
      }
    }

    // Limpiar el itemPassMap removiendo las entradas de las canciones eliminadas
    const newPassMap: Record<string, string> = { ...config.item_pass_map };
    itemsToDelete.forEach((itemId) => {
      delete newPassMap[itemId];
    });

    const currentOrder = config.section_order ?? config.passes.map((p) => p.id);
    const updatedConfig: SetlistNotesConfig = {
      ...config,
      passes: updatedPasses,
      item_pass_map: newPassMap,
      section_order: currentOrder.filter((id) => id !== passId),
    };

    const { error } = await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("setlist_items", "setlists");
    if (activePassId === passId) setActivePassId("all");
    setConfirmDeletePassId(null);
    toast.success(
      itemsToDelete.length > 0
        ? `Pase eliminado junto a sus ${itemsToDelete.length} canciones`
        : "Pase eliminado",
    );
  }

  // Guardar configuración del setlist
  async function handleSaveConfig() {
    if (!setlist) return;

    // Limpiar editSectionOrder para conservar IDs válidos
    const passIds = new Set(editPasses.map((p) => p.id));
    const breakIds = new Set(editBreaks.map((b) => b.id));
    const cleanedOrder = editSectionOrder.filter((id) => passIds.has(id) || breakIds.has(id));
    editPasses.forEach((p) => {
      if (!cleanedOrder.includes(p.id)) cleanedOrder.push(p.id);
    });
    editBreaks.forEach((b) => {
      if (!cleanedOrder.includes(b.id)) cleanedOrder.push(b.id);
    });

    const newConfig: SetlistNotesConfig = {
      ...config,
      target_minutes: editTargetMinutes,
      passes: editPasses,
      breaks: editBreaks,
      section_order: cleanedOrder,
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

  // Añadir MÚLTIPLES arreglos a un pase específico
  async function handleAddMultipleSongsToPass(passId: string, songIds: string[]) {
    if (!songIds.length) return;

    if (isProposalMode) {
      // En modo propuesta: añadir a lista virtual
      const newVirtual: VirtualItem[] = songIds.map((arrId, idx) => {
        const arr = (arrangements.data ?? []).find((a) => a.id === arrId);
        const tempId = `virtual_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
        return {
          id: tempId,
          arrangement_id: arrId,
          position: 0,
          pass_id: passId,
          arrangements: arr ?? null,
          manual_title: null,
          manual_duration_seconds: null,
        };
      });
      const nextMap = { ...proposalPassMap };
      newVirtual.forEach((vi) => {
        nextMap[vi.id] = passId;
      });
      setProposalPassMap(nextMap);
      setProposalItems((prev) =>
        renumberVirtualItems([...prev, ...newVirtual], nextMap, sectionOrder, fallbackPass),
      );
      toast.success(
        songIds.length === 1
          ? "1 canción añadida a la propuesta"
          : `${songIds.length} canciones añadidas a la propuesta`,
      );
      return;
    }

    const startPos = (items.data?.length ?? 0) + 1;
    const newItemsPayload = songIds.map((arrId, index) => ({
      setlist_id: setlistId,
      arrangement_id: arrId,
      position: startPos + index,
    }));

    const { data: inserted, error } = await supabase
      .from("setlist_items")
      .insert(newItemsPayload)
      .select("id");

    if (error) {
      toast.error(error.message);
      return;
    }

    const newPassMap = { ...itemPassMap };
    (inserted || []).forEach((newItem) => {
      newPassMap[newItem.id] = passId;
    });

    const updatedConfig: SetlistNotesConfig = { ...config, item_pass_map: newPassMap };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    invalidate("setlist_items", "setlists");
    toast.success(
      songIds.length === 1
        ? "1 arreglo añadido al pase"
        : `${songIds.length} arreglos añadidos al pase`,
    );
  }

  // Añadir una canción fuera de repertorio (nombre + duración manuales)
  async function handleAddManualSong(passId: string, title: string, durationSeconds: number) {
    if (isProposalMode) {
      const tempId = `virtual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const vi: VirtualItem = {
        id: tempId,
        arrangement_id: null,
        position: 0,
        pass_id: passId,
        arrangements: null,
        manual_title: title.trim(),
        manual_duration_seconds: Math.max(0, durationSeconds),
      };
      const nextMap = { ...proposalPassMap, [tempId]: passId };
      setProposalPassMap(nextMap);
      setProposalItems((prev) =>
        renumberVirtualItems([...prev, vi], nextMap, sectionOrder, fallbackPass),
      );
      toast.success("Canción manual añadida a la propuesta");
      return;
    }

    const startPos = (items.data?.length ?? 0) + 1;
    const { data: inserted, error } = await supabase
      .from("setlist_items")
      .insert({
        setlist_id: setlistId,
        arrangement_id: null,
        manual_title: title.trim(),
        manual_duration_seconds: Math.max(0, durationSeconds),
        position: startPos,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!inserted) return;

    const newPassMap = { ...itemPassMap, [inserted.id]: passId };
    const updatedConfig: SetlistNotesConfig = { ...config, item_pass_map: newPassMap };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    invalidate("setlist_items", "setlists");
    toast.success("Canción manual añadida al pase");
  }

  // Añadir un nuevo pase al final del timeline
  async function handleAddPass() {
    if (isProposalMode) return;
    const newPassNumber = config.passes.length + 1;
    const newPass: PassConfig = {
      id: `p${Date.now()}`,
      name: `Pase ${newPassNumber}`,
      target_minutes: 0,
    };

    const currentOrder = config.section_order ?? config.passes.map((p) => p.id);
    const updatedConfig: SetlistNotesConfig = {
      ...config,
      passes: [...config.passes, newPass],
      section_order: [...currentOrder, newPass.id],
    };

    const { error } = await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("setlists");
    toast.success(`"${newPass.name}" añadido al setlist`);
  }

  // Añadir descanso (insertado DESPUÉS de un pase específico en el timeline)
  async function handleAddBreak(minutes: number, afterSectionId: string, title?: string) {
    if (isProposalMode) return;
    const currentOrder = config.section_order ?? config.passes.map((p) => p.id);
    const insertIdx = currentOrder.indexOf(afterSectionId);

    // Evitar poner 2 descansos juntos
    if (insertIdx >= 0 && currentOrder[insertIdx + 1]?.startsWith("b_")) {
      toast.error("No se pueden colocar dos descansos juntos");
      return;
    }

    const newBreak: BreakItem = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      minutes: Math.max(1, minutes),
      title: title?.trim() || "Descanso",
    };

    const currentBreaks = config.breaks || [];

    // Insertar en section_order justo después de afterSectionId
    const newOrder = [...currentOrder];
    if (insertIdx >= 0) {
      newOrder.splice(insertIdx + 1, 0, newBreak.id);
    } else {
      newOrder.push(newBreak.id); // fallback: al final
    }

    const updatedConfig: SetlistNotesConfig = {
      ...config,
      breaks: [...currentBreaks, newBreak],
      section_order: newOrder,
    };

    const { error } = await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("setlists");
    toast.success(`Descanso de ${minutes} min añadido`);
  }

  async function handleUpdateBreak(breakId: string, deltaMinutes: number) {
    if (isProposalMode) return;
    const currentBreaks = config.breaks || [];
    const updatedBreaks = currentBreaks.map((b) => {
      if (b.id === breakId) {
        return { ...b, minutes: Math.max(1, b.minutes + deltaMinutes) };
      }
      return b;
    });

    const updatedConfig: SetlistNotesConfig = {
      ...config,
      breaks: updatedBreaks,
    };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    invalidate("setlists");
  }

  async function handleRemoveBreak(breakId: string) {
    if (isProposalMode) return;
    const currentBreaks = config.breaks || [];
    const currentOrder = config.section_order ?? config.passes.map((p) => p.id);
    const updatedConfig: SetlistNotesConfig = {
      ...config,
      breaks: currentBreaks.filter((b) => b.id !== breakId),
      section_order: currentOrder.filter((id) => id !== breakId),
    };

    await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlistId);

    invalidate("setlists");
    toast.success("Descanso eliminado");
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

  // Eliminar tema del setlist (con opción Deshacer)
  async function handleRemoveItem(itemId: string) {
    if (isProposalMode) {
      const nextMap = { ...proposalPassMap };
      delete nextMap[itemId];
      setProposalPassMap(nextMap);
      setProposalItems((prev) =>
        renumberVirtualItems(
          prev.filter((i) => i.id !== itemId),
          nextMap,
          sectionOrder,
          fallbackPass,
        ),
      );
      return;
    }

    const itemToDelete = items.data?.find((i) => i.id === itemId);
    const passId = itemPassMap[itemId];

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

    if (itemToDelete) {
      toast(`Tema "${itemTitleOf(itemToDelete)}" quitado del setlist`, {
        action: {
          label: "Deshacer",
          onClick: async () => {
            const { data: restored } = await supabase
              .from("setlist_items")
              .insert({
                id: itemToDelete.id,
                setlist_id: setlistId,
                arrangement_id: itemToDelete.arrangement_id,
                position: itemToDelete.position,
                manual_title: itemToDelete.manual_title,
                manual_duration_seconds: itemToDelete.manual_duration_seconds,
              })
              .select("id")
              .single();

            if (restored && passId) {
              const restoredMap = { ...config.item_pass_map, [restored.id]: passId };
              await supabase
                .from("setlists")
                .update({ notes: serializeSetlistNotes({ ...config, item_pass_map: restoredMap }) })
                .eq("id", setlistId);
            }

            invalidate("setlist_items", "setlists");
            toast.success("Tema restaurado en el setlist");
          },
        },
        duration: 8000,
      });
    }
  }

  // Reordenar dentro de un pase
  async function handleReorderPassItems(reorderedItems: { id: string }[]) {
    if (isProposalMode) {
      const first = reorderedItems[0];
      const passId = first ? proposalPassMap[first.id] || fallbackPass : fallbackPass;
      setProposalItems((prev) =>
        renumberVirtualItems(prev, proposalPassMap, sectionOrder, fallbackPass, {
          [passId]: reorderedItems.map((r) => r.id),
        }),
      );
      return;
    }
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

  // Cambiar item de pase
  async function handleMoveItemToPassLocal(itemId: string, newPassId: string) {
    if (isProposalMode) {
      const nextMap = { ...proposalPassMap, [itemId]: newPassId };
      setProposalPassMap(nextMap);
      setProposalItems((prev) => renumberVirtualItems(prev, nextMap, sectionOrder, fallbackPass));
      return;
    }
    await handleMoveItemToPass(itemId, newPassId);
  }

  // Enviar propuesta de cambio (solo no-admins)
  async function handleSubmitProposal() {
    if (!setlist || !user) return;

    const userMeta = user.user_metadata;
    const userName =
      userMeta?.["display_name"] ||
      userMeta?.["full_name"] ||
      user?.email?.split("@")[0] ||
      "Miembro";

    const bulkItems = proposalItems.map((vi) => ({
      arrangement_id: vi.arrangement_id,
      pass_id: proposalPassMap[vi.id] || config.passes[0]?.id || "",
      position: vi.position,
      title: itemTitleOf(vi),
      duration_seconds: itemDurationOf(vi),
      manual_title: vi.manual_title,
      manual_duration_seconds: vi.manual_duration_seconds,
    }));

    // Si no hay diferencias frente al estado inicial, no tiene sentido proponer
    const signature = (items: VirtualItem[], map: Record<string, string>) =>
      items
        .map(
          (i) =>
            `${i.arrangement_id ?? "manual"}:${i.manual_title ?? ""}:${i.manual_duration_seconds ?? 0}:${map[i.id] ?? ""}:${i.position}`,
        )
        .join("|");
    const start = proposalStartRef.current;
    if (
      start &&
      signature(proposalItems, proposalPassMap) === signature(start.items, start.passMap)
    ) {
      toast.error("No hay cambios que proponer");
      return;
    }

    const newProp: SetlistProposal = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      setlist_id: setlist.id,
      setlist_name: setlist.name,
      arrangement_id: "",
      arrangement_title: `${bulkItems.length} ${bulkItems.length === 1 ? "canción" : "canciones"}`,
      pass_id: "",
      pass_name: "",
      user_id: user.id,
      user_name: userName,
      created_at: new Date().toISOString(),
      status: "pending",
      kind: "bulk_edit",
      bulk_items: bulkItems,
    };

    const updatedConfig: SetlistNotesConfig = {
      ...config,
      proposals: [...(config.proposals ?? []), newProp],
    };

    const { error } = await supabase
      .from("setlists")
      .update({ notes: serializeSetlistNotes(updatedConfig) })
      .eq("id", setlist.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("setlists");
    setIsProposalMode(false);
    setIsEditingItems(false);
    proposalStartRef.current = null;
    toast.success("Propuesta de cambio enviada a los administradores ✓");
  }

  // Handlers de cross-container DnD
  function handleDragStart(event: DragStartEvent) {
    setDraggingItemId(String(event.active.id));
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(15);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingItemId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Determinar si over es un pase (contenedor) o un item
    const isOverAPass = config.passes.some((p) => p.id === overId);
    const targetPassId = isOverAPass ? overId : activePassMap[overId] || fallbackPass;

    const currentPassId = activePassMap[activeId] || fallbackPass;

    if (targetPassId !== currentPassId) {
      // Mover a otro pase
      if (isProposalMode) {
        await handleMoveItemToPassLocal(activeId, targetPassId);
      } else {
        await handleMoveItemToPass(activeId, targetPassId);
      }
    } else {
      // Reordenar dentro del mismo pase
      if (activeId !== overId && !isOverAPass) {
        const passItems = activeItems.filter(
          (i) => (activePassMap[i.id] || fallbackPass) === currentPassId,
        );
        const oldIndex = passItems.findIndex((i) => i.id === activeId);
        const newIndex = passItems.findIndex((i) => i.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          await handleReorderPassItems(arrayMove(passItems, oldIndex, newIndex));
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Modal de letra en modo lectura */}
      {activeLyric && (
        <SetlistLyricModal lyric={activeLyric} onClose={() => setActiveLyric(null)} />
      )}

      {/* Modal para añadir múltiples canciones a un pase */}
      {addingSongsPass && (
        <AddSongsToPassModal
          passName={addingSongsPass.name}
          arrangements={arrangements.data ?? []}
          onClose={() => setAddingSongsPass(null)}
          onAdd={async (songIds) => {
            await handleAddMultipleSongsToPass(addingSongsPass.id, songIds);
          }}
          onAddManual={async (title, durationSeconds) => {
            await handleAddManualSong(addingSongsPass.id, title, durationSeconds);
          }}
        />
      )}

      {/* Modal para añadir descanso entre secciones */}
      {showBreakModal && (
        <AddBreakModal
          passes={config.passes}
          sectionOrder={config.section_order ?? config.passes.map((p) => p.id)}
          onClose={() => setShowBreakModal(false)}
          onAdd={async (minutes, afterSectionId, title) => {
            await handleAddBreak(minutes, afterSectionId, title);
          }}
        />
      )}

      {/* Botón Volver, Modificar Canciones y Configurar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-accent"
        >
          ← Volver a setlists
        </button>

        <div className="flex items-center gap-2">
          {/* Admin: Editar/Guardar | No-admin: Proponer Cambio/Enviar propuesta */}
          {isAdmin ? (
            // ADMIN: cambios directos
            <button
              onClick={() => setIsEditingItems((prev) => !prev)}
              className={`comic-sm comic-press flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase transition-colors ${
                isEditingItems
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {isEditingItems ? (
                <>
                  <Save className="h-3.5 w-3.5" /> Guardar
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" /> Editar canciones
                </>
              )}
            </button>
          ) : isProposalMode ? (
            // NO-ADMIN en modo propuesta: cancel + enviar
            <>
              <button
                onClick={() => {
                  setIsProposalMode(false);
                  setIsEditingItems(false);
                }}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
              <button
                onClick={handleSubmitProposal}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-amber-600"
              >
                <Lightbulb className="h-3.5 w-3.5" /> Enviar propuesta
              </button>
            </>
          ) : (
            // NO-ADMIN en modo lectura: botón Proponer Cambio
            <button
              onClick={() => {
                // Inicializar items virtuales desde el estado actual de la BD
                const currentVirtual: VirtualItem[] = (items.data ?? []).map((item) => ({
                  id: item.id,
                  arrangement_id: item.arrangement_id,
                  position: item.position,
                  pass_id: itemPassMap[item.id] || fallbackPass,
                  arrangements: item.arrangements,
                  manual_title: item.manual_title,
                  manual_duration_seconds: item.manual_duration_seconds,
                }));
                setProposalItems(currentVirtual);
                setProposalPassMap({ ...itemPassMap });
                proposalStartRef.current = { items: currentVirtual, passMap: { ...itemPassMap } };
                setIsProposalMode(true);
                setIsEditingItems(true);
              }}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 text-xs font-extrabold uppercase hover:bg-amber-500/20 transition-colors"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Proponer cambio
            </button>
          )}

          {/* Configurar Setlist: solo admin (los no-admin proponen cambios) */}
          {isAdmin && (
            <button
              onClick={() => {
                setEditName(setlist?.name || "");
                setEditDate(setlist?.event_date || "");
                setEditTargetMinutes(config.target_minutes);
                setEditPasses(config.passes);
                setEditBreaks(config.breaks ?? []);
                setEditSectionOrder(
                  config.section_order ?? [
                    ...config.passes.map((p) => p.id),
                    ...(config.breaks ?? []).map((b) => b.id),
                  ],
                );
                setEditingConfig(true);
              }}
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-extrabold uppercase text-secondary-foreground"
            >
              <Settings className="h-3.5 w-3.5" /> Configurar Setlist
            </button>
          )}
        </div>
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
              {activeItems.length} temas
            </span>
          </div>
        </div>

        {/* Indicadores Comparativos de Tiempo General (2 tarjetas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-background p-3">
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Duración Total del Show
            </p>
            <p className="text-2xl font-extrabold leading-tight text-primary">
              {overallComp.addedText}
            </p>
            {totalSecondsBreaks > 0 && (
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {formatLongDuration(totalSecondsSongs)} canciones ·{" "}
                {formatLongDuration(totalSecondsBreaks)} descansos
              </p>
            )}
          </div>

          <div className="rounded-lg bg-background p-3">
            <p className="text-[11px] font-extrabold uppercase text-muted-foreground">
              Duración Objetivo Total
            </p>
            <p className="text-2xl font-extrabold leading-tight">
              {config.target_minutes > 0 ? overallComp.targetText : "Sin objetivo"}
            </p>
          </div>
        </div>

        {/* Barra de Progreso General (canciones + descansos vs objetivo) */}
        {config.target_minutes > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-extrabold">
              <span>Progreso general: {overallComp.percentage}%</span>
              <span>
                {overallComp.addedText} / {overallComp.targetText} ({overallComp.diffText})
              </span>
            </div>
            <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-secondary border border-ink/20">
              {/* Segmento de canciones */}
              <div
                className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                  overallComp.status === "exceeded"
                    ? "bg-amber-500"
                    : overallComp.percentage >= 100
                      ? "bg-emerald-500"
                      : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(100, Math.round((totalSecondsSongs / (config.target_minutes * 60)) * 100))}%`,
                }}
              />
              {/* Segmento de descansos */}
              {totalSecondsBreaks > 0 && (
                <div
                  className="absolute top-0 h-full bg-amber-400/70 transition-all duration-500"
                  style={{
                    left: `${Math.min(100, Math.round((totalSecondsSongs / (config.target_minutes * 60)) * 100))}%`,
                    width: `${Math.min(
                      100 -
                        Math.min(
                          100,
                          Math.round((totalSecondsSongs / (config.target_minutes * 60)) * 100),
                        ),
                      Math.round((totalSecondsBreaks / (config.target_minutes * 60)) * 100),
                    )}%`,
                  }}
                />
              )}
            </div>
            {totalSecondsBreaks > 0 && (
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary" /> Canciones
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400/70" /> Descansos
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pestañas de Selección de Pases (tamaño reducido) */}
      {config.passes.length > 1 && (
        <div className="comic-sm flex overflow-x-auto rounded-lg border bg-card p-1 gap-1">
          <button
            onClick={() => setActivePassId("all")}
            className={`px-2.5 py-1 text-[11px] font-extrabold uppercase rounded transition-colors shrink-0 ${
              activePassId === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Todos ({config.passes.length})
          </button>
          {config.passes.map((p) => {
            const passItems = activeItems.filter(
              (i) => (activePassMap[i.id] || fallbackPass) === p.id,
            );
            const passSeconds = passItems.reduce((s, i) => s + itemDurationOf(i), 0);

            return (
              <button
                key={p.id}
                onClick={() => setActivePassId(p.id)}
                className={`px-2.5 py-1 text-[11px] font-extrabold uppercase rounded transition-colors shrink-0 ${
                  activePassId === p.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {p.name} ({formatLongDuration(passSeconds)})
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de acciones de estructura del setlist (entre tabs y tarjetas de pase) */}
      {isAdmin && isEditingItems && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddPass}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-xs font-extrabold uppercase border border-primary/30"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir Pase
          </button>
          <button
            type="button"
            onClick={() => setShowBreakModal(true)}
            className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-extrabold uppercase border border-amber-500/30"
          >
            <Coffee className="h-3.5 w-3.5" /> Añadir Descanso
          </button>
          <button
            onClick={() => setIsEditingItems(false)}
            className="comic-sm comic-press flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-extrabold uppercase text-white hover:opacity-90 ml-auto"
          >
            <Save className="h-3.5 w-3.5" /> Guardar
          </button>
        </div>
      )}

      {/* Renderizado de Secciones por Pase (cross-container DnD en modo edición) */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragCancel={() => setDraggingItemId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {/* Render sections in section_order: each can be a pass card or a break bar */}
          {(config.section_order ?? config.passes.map((p) => p.id))
            .filter((sectionId) => {
              // Filter: if a specific pass is selected, show only that pass section (and skip breaks/other passes)
              if (activePassId === "all") return true;
              const isPass = config.passes.some((p) => p.id === sectionId);
              if (isPass) return sectionId === activePassId;
              return false; // hide breaks when filtering by specific pass
            })
            .map((sectionId) => {
              // Check if this section is a break
              const breakItem = (config.breaks ?? []).find((b) => b.id === sectionId);
              if (breakItem) {
                // Render break bar as top-level section
                return isEditingItems && isAdmin ? (
                  <div
                    key={breakItem.id}
                    className="comic flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 p-3 text-amber-900 dark:text-amber-200"
                  >
                    <div className="flex items-center gap-2 font-extrabold text-sm">
                      <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{breakItem.title || "DESCANSO"}</span>
                      <span className="comic-sm rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold">
                        {breakItem.minutes} min
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateBreak(breakItem.id, -5)}
                        className="comic-sm rounded bg-background px-2 py-0.5 text-xs font-bold hover:bg-muted"
                        title="Reducir 5 min"
                      >
                        -5m
                      </button>
                      <button
                        onClick={() => handleUpdateBreak(breakItem.id, 5)}
                        className="comic-sm rounded bg-background px-2 py-0.5 text-xs font-bold hover:bg-muted"
                        title="Aumentar 5 min"
                      >
                        +5m
                      </button>
                      <button
                        onClick={() => handleRemoveBreak(breakItem.id)}
                        aria-label="Eliminar descanso"
                        className="comic-sm comic-press rounded bg-destructive/10 p-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={breakItem.id}
                    className="comic flex items-center justify-between gap-3 rounded-xl bg-amber-500/15 border border-amber-500/40 p-3 text-amber-900 dark:text-amber-200 shadow-sm"
                  >
                    <div className="flex items-center gap-2 font-extrabold text-base">
                      <Coffee className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{breakItem.title || "DESCANSO"}</span>
                    </div>
                    <span className="comic-sm rounded bg-amber-500/25 px-3 py-1 text-xs font-extrabold uppercase font-mono">
                      ☕ {breakItem.minutes} MIN
                    </span>
                  </div>
                );
              }

              // Otherwise render a pass card
              const pass = config.passes.find((p) => p.id === sectionId);
              if (!pass) return null;

              const passItems = activeItems.filter((i) => {
                const assignedPass = activePassMap[i.id] || fallbackPass;
                return assignedPass === pass.id;
              });

              const passSongSeconds = passItems.reduce((acc, i) => acc + itemDurationOf(i), 0);

              const passComp = formatTimeComparison(passSongSeconds, pass.target_minutes);

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

                    <div className="flex items-center gap-1.5">
                      {isEditingItems ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setAddingSongsPass({ id: pass.id, name: pass.name })}
                            className="comic-sm comic-press flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" /> Añadir canciones
                          </button>
                          {isAdmin && config.passes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePassId(pass.id)}
                              aria-label="Eliminar pase"
                              className="comic-sm comic-press flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs font-extrabold uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        pass.target_minutes > 0 && (
                          <span
                            className={`comic-sm rounded px-2.5 py-1 text-xs font-extrabold uppercase ${
                              passComp.status === "exact" || passComp.status === "exceeded"
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                : "bg-accent text-accent-foreground"
                            }`}
                          >
                            {passComp.diffText}
                          </span>
                        )
                      )}
                    </div>
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

                  {/* Lista de arreglos del pase (Lectura vs Edición) */}
                  {passItems.length === 0 ? (
                    isEditingItems ? (
                      <PassDropZone passId={pass.id}>
                        <p className="comic-sm rounded-lg bg-background p-4 text-center text-xs font-bold text-muted-foreground border-2 border-dashed border-primary/30">
                          Arrastra canciones aquí para asignarlas a {pass.name}
                        </p>
                      </PassDropZone>
                    ) : (
                      <p className="comic-sm rounded-lg bg-background p-4 text-center text-xs font-bold text-muted-foreground">
                        Este pase aún no tiene canciones.
                      </p>
                    )
                  ) : isEditingItems ? (
                    <PassDropZone passId={pass.id}>
                      <SortableContext
                        items={passItems.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {passItems.map((item, index) => (
                            <DraggableItem
                              key={item.id}
                              id={item.id}
                              className="comic grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-background p-3 my-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-primary mb-0.5">
                                  #{index + 1}
                                  {isManualItem(item) && (
                                    <span className="comic-sm ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-700 dark:text-amber-300">
                                      Fuera de repertorio
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-base font-extrabold leading-tight">
                                  {itemTitleOf(item) || "Cargando..."}
                                </p>
                                <p className="text-xs font-bold text-muted-foreground">
                                  {formatDuration(itemDurationOf(item))}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2 ml-auto">
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  aria-label="Quitar canción"
                                  className="comic-sm comic-press rounded bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </DraggableItem>
                          ))}
                        </div>
                      </SortableContext>
                    </PassDropZone>
                  ) : (
                    <div className="space-y-2">
                      {passItems.map((item, index) => {
                        const lyric = findLyricForArrangement(item.arrangement_id);
                        return (
                          <div
                            key={item.id}
                            className={`comic flex items-center justify-between gap-3 rounded-xl bg-background p-3.5 ${
                              lyric ? "cursor-pointer hover:bg-primary/5 transition-colors" : ""
                            }`}
                            onClick={() => lyric && setActiveLyric(lyric)}
                            title={lyric ? "Ver letra" : undefined}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="shrink-0 text-xl font-extrabold text-primary w-7 text-center">
                                #{index + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-lg font-extrabold leading-tight">
                                  {itemTitleOf(item) || "Cargando..."}
                                </p>
                                {isManualItem(item) && (
                                  <span className="comic-sm mt-0.5 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-700 dark:text-amber-300">
                                    Fuera de repertorio
                                  </span>
                                )}
                                {!!item.arrangements?.tags?.length && (
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {item.arrangements.tags.map((t) => (
                                      <span
                                        key={t}
                                        className="comic-sm rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase text-secondary-foreground"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-sm font-extrabold text-muted-foreground font-mono">
                                {formatDuration(itemDurationOf(item))}
                              </span>
                              {lyric && <BookOpen className="h-4 w-4 text-primary/60" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Overlay visual mientras se arrastra */}
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {draggingItemId &&
            (() => {
              const draggedItem = activeItems.find((i) => i.id === draggingItemId);
              if (!draggedItem) return null;
              return (
                <div className="comic pointer-events-none flex rotate-1 scale-[1.03] items-center gap-3 rounded-xl bg-primary text-primary-foreground p-3 shadow-2xl">
                  <GripVertical className="h-5 w-5 shrink-0" />
                  <span className="font-extrabold text-base">
                    {itemTitleOf(draggedItem) || "Canción"}
                  </span>
                  <span className="ml-auto text-xs font-bold opacity-75">
                    {formatDuration(itemDurationOf(draggedItem))}
                  </span>
                </div>
              );
            })()}
        </DragOverlay>
      </DndContext>

      {/* Modal Editar Configuración de Setlist y Pases */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4 pb-10">
          <div className="comic w-full max-w-md rounded-xl bg-card p-5 space-y-4 mt-4">
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
                className="comic-sm w-full min-w-0 rounded-md bg-background px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase">
                Duración objetivo total (minutos)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
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

            {/* Estructura unificada y reordenable de pases y descansos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Estructura y Orden del Show
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const passNum = editPasses.length + 1;
                      const newPass: PassConfig = {
                        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                        name: `Pase ${passNum}`,
                        target_minutes: 30,
                      };
                      setEditPasses([...editPasses, newPass]);
                      setEditSectionOrder([...editSectionOrder, newPass.id]);
                    }}
                    className="comic-sm rounded bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 text-xs font-extrabold uppercase border border-primary/30 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Pase
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newBreak: BreakItem = {
                        id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                        minutes: 15,
                        title: "Descanso",
                      };
                      setEditBreaks([...editBreaks, newBreak]);
                      setEditSectionOrder([...editSectionOrder, newBreak.id]);
                    }}
                    className="comic-sm rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 px-2 py-1 text-xs font-extrabold uppercase border border-amber-500/30 flex items-center gap-1"
                  >
                    <Coffee className="h-3 w-3" /> Descanso
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground font-bold">
                Usa los botones <span className="font-mono">▲</span> y{" "}
                <span className="font-mono">▼</span> para ordenar la secuencia.
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {editSectionOrder.map((sectionId, idx) => {
                  const pass = editPasses.find((p) => p.id === sectionId);
                  const breakItem = editBreaks.find((b) => b.id === sectionId);
                  const isPass = !!pass;
                  if (!pass && !breakItem) return null;

                  return (
                    <ConfigSectionRow
                      key={sectionId}
                      index={idx}
                      total={editSectionOrder.length}
                      id={sectionId}
                      isPass={isPass}
                      {...(pass ? { pass } : {})}
                      {...(breakItem ? { breakItem } : {})}
                      onMoveUp={() => {
                        if (idx > 0) {
                          const next = [...editSectionOrder];
                          const [item] = next.splice(idx, 1);
                          if (item) next.splice(idx - 1, 0, item);
                          setEditSectionOrder(next);
                        }
                      }}
                      onMoveDown={() => {
                        if (idx < editSectionOrder.length - 1) {
                          const next = [...editSectionOrder];
                          const [item] = next.splice(idx, 1);
                          if (item) next.splice(idx + 1, 0, item);
                          setEditSectionOrder(next);
                        }
                      }}
                      onUpdatePass={(updated) => {
                        setEditPasses(editPasses.map((p) => (p.id === updated.id ? updated : p)));
                      }}
                      onUpdateBreak={(updated) => {
                        setEditBreaks(editBreaks.map((b) => (b.id === updated.id ? updated : b)));
                      }}
                      onRemovePass={() => {
                        setEditPasses(editPasses.filter((p) => p.id !== sectionId));
                        setEditSectionOrder(editSectionOrder.filter((id) => id !== sectionId));
                      }}
                      onRemoveBreak={() => {
                        setEditBreaks(editBreaks.filter((b) => b.id !== sectionId));
                        setEditSectionOrder(editSectionOrder.filter((id) => id !== sectionId));
                      }}
                      canRemovePass={editPasses.length > 1}
                    />
                  );
                })}
              </div>
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

      {/* Popup de confirmación de borrado de pase */}
      {confirmDeletePassId &&
        (() => {
          const passToDelete = config.passes.find((p) => p.id === confirmDeletePassId);
          return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/70 p-4">
              <div className="comic w-full max-w-xs rounded-xl bg-card p-6 space-y-4 shadow-2xl">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="rounded-full bg-destructive/10 p-3">
                    <Trash2 className="h-7 w-7 text-destructive" />
                  </div>
                  <h2 className="text-xl font-extrabold leading-tight">
                    ¿Eliminar {passToDelete?.name ?? "este pase"}?
                  </h2>
                  <p className="text-xs font-bold text-muted-foreground">
                    Se eliminarán el pase y todas las canciones asignadas a él. Esta acción no se
                    puede deshacer.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDeletePassId(null)}
                    className="comic-sm flex-1 rounded-lg bg-accent py-2 text-sm font-extrabold uppercase hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDeletePass(confirmDeletePassId)}
                    className="comic comic-press flex-1 rounded-lg bg-destructive py-2 text-sm font-extrabold uppercase text-destructive-foreground"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
