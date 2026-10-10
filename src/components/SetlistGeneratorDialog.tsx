import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Shuffle, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format";
import { generateSetlist } from "@/lib/setlistGenerator";
import { haptic } from "@/lib/haptics";
import type { Arrangement } from "@/lib/queries";

const PRESETS = [30, 45, 60, 90];

export function SetlistGeneratorDialog({
  open,
  onOpenChange,
  arrangements,
  passes,
  excludeIds,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arrangements: Arrangement[];
  passes: { id: string; name: string }[];
  excludeIds: string[];
  onApply: (passId: string, ids: string[]) => void | Promise<void>;
}) {
  const [minutes, setMinutes] = useState(45);
  const [passId, setPassId] = useState(passes[0]?.id ?? "");
  const [history, setHistory] = useState<string[][]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!passes.some((p) => p.id === passId)) setPassId(passes[0]?.id ?? "");
    void supabase
      .from("setlist_items")
      .select("setlist_id, arrangement_id, position")
      .order("position")
      .then(({ data }) => {
        const by = new Map<string, string[]>();
        for (const r of data ?? []) {
          if (!r.arrangement_id) continue;
          const arr = by.get(r.setlist_id) ?? [];
          arr.push(r.arrangement_id);
          by.set(r.setlist_id, arr);
        }
        setHistory([...by.values()]);
      });
  }, [open, passes, passId]);

  const byId = useMemo(() => new Map(arrangements.map((a) => [a.id, a])), [arrangements]);
  const total = ids.reduce((s, id) => s + (byId.get(id)?.duration_seconds ?? 0), 0);
  const diff = total - minutes * 60;

  function run(keep: string[] = []) {
    const keptTotal = keep.reduce((s, id) => s + (byId.get(id)?.duration_seconds ?? 0), 0);
    const r = generateSetlist({
      songs: arrangements.map((a) => ({ id: a.id, duration: a.duration_seconds })),
      history,
      targetSeconds: Math.max(60, minutes * 60 - keptTotal),
      exclude: [...excludeIds, ...keep],
    });
    setIds([...keep, ...r.ids]);
    haptic("selection");
  }

  function swap(index: number) {
    const others = ids.filter((_, i) => i !== index);
    const current = byId.get(ids[index]!)?.duration_seconds ?? 0;
    const used = new Set([...ids, ...excludeIds]);
    const cands = arrangements
      .filter((a) => !used.has(a.id) && a.duration_seconds > 0)
      .sort(
        (a, b) =>
          Math.abs(a.duration_seconds - current) - Math.abs(b.duration_seconds - current),
      )
      .slice(0, 5);
    const pick = cands[Math.floor(Math.random() * cands.length)];
    if (!pick) return;
    others.splice(index, 0, pick.id);
    setIds(others);
    haptic("selection");
  }

  async function apply() {
    if (!passId || !ids.length) return;
    setBusy(true);
    await onApply(passId, ids);
    setBusy(false);
    haptic("success");
    setIds([]);
    onOpenChange(false);
  }

  const inWindow = Math.abs(diff) <= 300;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Generar setlist
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase text-muted-foreground">
              Duración objetivo (±5 min)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={`comic-sm comic-press rounded-lg px-3 py-2 text-sm font-extrabold ${
                    minutes === m ? "bg-primary text-primary-foreground" : "bg-card"
                  }`}
                >
                  {m} min
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 0))}
                className="comic-sm w-20 rounded-lg bg-card px-2 py-2 text-sm font-bold"
                aria-label="Minutos"
              />
            </div>
          </div>
          {passes.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-extrabold uppercase text-muted-foreground">Añadir al pase</p>
              <select
                value={passId}
                onChange={(e) => setPassId(e.target.value)}
                className="comic-sm w-full rounded-lg bg-card px-3 py-2 text-sm font-bold"
              >
                {passes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => run()}
            className="comic comic-press flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-extrabold uppercase text-primary-foreground"
          >
            {ids.length ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {ids.length ? "Regenerar" : "Generar"}
          </button>

          {ids.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-extrabold">
                <span>{ids.length} temas · {formatDuration(total)}</span>
                <span className={inWindow ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                  {diff >= 0 ? "+" : "−"}
                  {formatDuration(Math.abs(diff))}
                </span>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {ids.map((id, i) => {
                  const a = byId.get(id);
                  return (
                    <li key={id} className="comic-sm flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                      <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 truncate text-sm font-bold">{a?.title}</span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {formatDuration(a?.duration_seconds ?? 0)}
                      </span>
                      <button onClick={() => swap(i)} aria-label="Cambiar tema" className="p-1.5">
                        <Shuffle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setIds(ids.filter((x) => x !== id))}
                        aria-label="Quitar tema"
                        className="p-1.5"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                disabled={busy}
                onClick={apply}
                className="comic comic-press w-full rounded-lg bg-emerald-600 py-3 font-extrabold uppercase text-white disabled:opacity-60"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
