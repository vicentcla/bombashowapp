import { useMemo, useState } from "react";
import { Minus, Plus, RotateCcw, BarChart3, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAddPlay,
  usePlayEvents,
  usePeriods,
  useResetCounters,
  type Scope,
} from "@/lib/queries";
import { normalize } from "@/lib/format";
import { SortableList, SortableItem } from "@/components/SortableList";

export type CounterItem = {
  id: string;
  title: string;
  subtitle?: string;
  tags?: string[];
};

/** Recuentos del periodo abierto para el ámbito indicado. */
export function useCurrentCounts(scope: Scope) {
  const events = usePlayEvents(scope);
  const periods = usePeriods(scope);
  const idField = scope === "calle" ? "street_song_id" : "arrangement_id";
  const currentPeriod = periods.data?.find((p) => p.ended_at === null) ?? null;

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events.data ?? []) {
      if (currentPeriod && e.period_id !== currentPeriod.id) continue;
      const key = e[idField];
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events.data, currentPeriod, idField]);
}

export function Counters({
  scope,
  items,
  search,
  onReorder,
}: {
  scope: Scope;
  items: CounterItem[];
  search: string;
  /** Callback con el array de items reordenados (modo manual). */
  onReorder?: (newItems: CounterItem[]) => void;
}) {
  const addPlay = useAddPlay(scope);
  const reset = useResetCounters(scope);
  const counts = useCurrentCounts(scope);
  const [showStats, setShowStats] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return items;
    return items.filter(
      (i) => normalize(i.title).includes(q) || (i.tags ?? []).some((t) => normalize(t).includes(q)),
    );
  }, [items, search]);

  async function change(songId: string, delta: 1 | -1) {
    try {
      await addPlay.mutateAsync({ songId, delta });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    }
  }

  async function doReset() {
    if (!confirm("¿Poner todos los contadores a 0 y empezar un periodo nuevo?")) return;
    const label = prompt("Nombre para el periodo que cierras (opcional)", "") ?? "";
    try {
      await reset.mutateAsync(label);
      toast.success("Contadores reiniciados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reiniciar");
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setShowStats(true)}
          className="comic comic-press flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-extrabold uppercase text-accent-foreground"
        >
          <BarChart3 className="h-4 w-4" /> Estadísticas
        </button>
        <button
          onClick={doReset}
          className="comic comic-press flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-extrabold uppercase text-destructive-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Resetear a 0
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
          Todavía no hay canciones aquí.
        </p>
      )}

      {onReorder ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <SortableList
            items={filtered}
            onReorder={onReorder}
            strategy="grid"
          >
            {(item) => (
              <SortableItem key={item.id} id={item.id} handleOnly className="comic-sm flex flex-col rounded-lg bg-card p-2">
                <CounterCard item={item} counts={counts} onChange={change} showGrip />
              </SortableItem>
            )}
          </SortableList>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <div key={item.id} className="comic-sm flex flex-col rounded-lg bg-card p-2">
              <CounterCard item={item} counts={counts} onChange={change} showGrip={false} />
            </div>
          ))}
        </div>
      )}

      {showStats && (
        <StatsDialog scope={scope} items={items} onClose={() => setShowStats(false)} />
      )}
    </div>
  );
}

// ─── Tarjeta de contador individual ─────────────────────────────────────────

function CounterCard({
  item,
  counts,
  onChange,
  showGrip,
}: {
  item: CounterItem;
  counts: Map<string, number>;
  onChange: (id: string, delta: 1 | -1) => Promise<void>;
  showGrip: boolean;
}) {
  const count = counts.get(item.id) ?? 0;
  return (
    <>
      <p className="line-clamp-2 min-h-8 text-sm font-extrabold leading-tight">{item.title}</p>
      {item.subtitle && (
        <p className="text-[10px] font-bold text-muted-foreground">{item.subtitle}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-1 pt-1">
        <button
          onClick={() => onChange(item.id, -1)}
          aria-label={`Restar a ${item.title}`}
          className="comic-sm comic-press rounded bg-secondary p-1.5"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-2xl leading-none">{count}</span>
        <button
          onClick={() => onChange(item.id, 1)}
          aria-label={`Sumar a ${item.title}`}
          className="comic-sm comic-press rounded bg-primary p-1.5 text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {showGrip && (
        <p className="mt-1 text-center text-[9px] font-bold uppercase text-muted-foreground/60">
          ≡ arrastra
        </p>
      )}
    </>
  );
}

type View = "month" | "year" | "period";

function StatsDialog({
  scope,
  items,
  onClose,
}: {
  scope: Scope;
  items: CounterItem[];
  onClose: () => void;
}) {
  const events = usePlayEvents(scope);
  const periods = usePeriods(scope);
  const [view, setView] = useState<View>("period");
  const [bucket, setBucket] = useState<string>("");

  const idField = scope === "calle" ? "street_song_id" : "arrangement_id";

  const buckets = useMemo(() => {
    const list = events.data ?? [];
    if (view === "month") {
      const set = new Set(list.map((e) => e.played_at.slice(0, 7)));
      return [...set]
        .sort()
        .reverse()
        .map((v) => ({ value: v, label: v }));
    }
    if (view === "year") {
      const set = new Set(list.map((e) => e.played_at.slice(0, 4)));
      return [...set]
        .sort()
        .reverse()
        .map((v) => ({ value: v, label: v }));
    }
    return (periods.data ?? []).map((p) => ({
      value: p.id,
      label:
        (p.label ?? "Periodo") +
        " · " +
        new Date(p.started_at).toLocaleDateString("es-ES") +
        (p.ended_at ? ` → ${new Date(p.ended_at).toLocaleDateString("es-ES")}` : " (en curso)"),
    }));
  }, [events.data, periods.data, view]);

  const active = bucket || buckets[0]?.value || "";

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events.data ?? []) {
      const key = e[idField];
      if (!key) continue;
      const matches =
        view === "month"
          ? e.played_at.slice(0, 7) === active
          : view === "year"
            ? e.played_at.slice(0, 4) === active
            : e.period_id === active;
      if (!matches) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return items
      .map((i) => ({ title: i.title, count: counts.get(i.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }, [events.data, items, view, active, idField]);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4">
      <div className="comic w-full max-w-xl rounded-xl bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto text-2xl leading-none">Estadísticas</h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="comic-sm mb-3 flex overflow-hidden rounded-md">
          {(
            [
              ["month", "Mes"],
              ["year", "Año"],
              ["period", "Reseteos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setView(value);
                setBucket("");
              }}
              className={`flex-1 px-3 py-2 text-sm font-extrabold uppercase ${
                view === value ? "bg-primary text-primary-foreground" : "bg-card"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={active}
          onChange={(e) => setBucket(e.target.value)}
          className="comic-sm mb-3 w-full rounded-md bg-background px-3 py-2 outline-none"
        >
          {buckets.length === 0 && <option value="">Sin datos</option>}
          {buckets.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-ink text-xs uppercase">
              <th className="py-1">Canción</th>
              <th className="w-20 py-1 text-right">Veces</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.title} className="border-b border-border/40">
                <td className="py-1 pr-2">{r.title}</td>
                <td className="py-1 text-right font-bold">{r.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink">
              <td className="py-1 font-extrabold uppercase">Total</td>
              <td className="py-1 text-right font-extrabold">{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
