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

export type CounterItem = {
  id: string;
  title: string;
  subtitle?: string;
  tags?: string[];
};

export function Counters({
  scope,
  items,
  search,
}: {
  scope: Scope;
  items: CounterItem[];
  search: string;
}) {
  const events = usePlayEvents(scope);
  const periods = usePeriods(scope);
  const addPlay = useAddPlay(scope);
  const reset = useResetCounters(scope);
  const [showStats, setShowStats] = useState(false);

  const idField = scope === "street" ? "street_song_id" : "arrangement_id";
  const currentPeriod = periods.data?.find((p) => p.ended_at === null) ?? null;

  const currentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events.data ?? []) {
      if (currentPeriod && e.period_id !== currentPeriod.id) continue;
      const key = e[idField];
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events.data, currentPeriod, idField]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return items;
    return items.filter(
      (i) =>
        normalize(i.title).includes(q) ||
        (i.tags ?? []).some((t) => normalize(t).includes(q)),
    );
  }, [items, search]);

  async function doReset() {
    const label = prompt("Nombre para el periodo que cierras (opcional)", "") ?? "";
    if (!confirm("¿Poner todos los contadores a 0 y empezar un periodo nuevo?")) return;
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

      <div className="space-y-2">
        {filtered.map((item) => {
          const count = currentCounts.get(item.id) ?? 0;
          return (
            <div
              key={item.id}
              className="comic grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xl leading-tight">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs font-bold text-muted-foreground">{item.subtitle}</p>
                )}
                {!!item.tags?.length && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tags.map((t) => (
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
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => addPlay.mutate({ songId: item.id, delta: -1 })}
                  aria-label={`Restar a ${item.title}`}
                  className="comic-sm comic-press rounded-md bg-secondary p-2"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-10 text-center text-3xl leading-none">{count}</span>
                <button
                  onClick={() => addPlay.mutate({ songId: item.id, delta: 1 })}
                  aria-label={`Sumar a ${item.title}`}
                  className="comic-sm comic-press rounded-md bg-primary p-2 text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showStats && (
        <StatsDialog scope={scope} items={items} onClose={() => setShowStats(false)} />
      )}
    </div>
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

  const idField = scope === "street" ? "street_song_id" : "arrangement_id";

  const buckets = useMemo(() => {
    const list = events.data ?? [];
    if (view === "month") {
      const set = new Set(list.map((e) => e.played_at.slice(0, 7)));
      return [...set].sort().reverse().map((v) => ({ value: v, label: v }));
    }
    if (view === "year") {
      const set = new Set(list.map((e) => e.played_at.slice(0, 4)));
      return [...set].sort().reverse().map((v) => ({ value: v, label: v }));
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
