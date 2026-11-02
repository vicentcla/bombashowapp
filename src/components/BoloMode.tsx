import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, ChevronRight, FileMusic, FileText, Music2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLyrics, useSetlists, type Lyric } from "@/lib/queries";
import { parseSetlistNotes } from "@/routes/_authenticated/setlists";
import { haptic } from "@/lib/haptics";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LyricViewerModal } from "@/components/LyricViewerModal";

type Bolo = {
  id: string;
  title: string;
  fecha: string | null;
  setlist_ids: string[];
  archived: boolean;
};

type Item = {
  id: string;
  setlist_id: string;
  position: number;
  arrangement_id: string | null;
  manual_title: string | null;
  arrangements: { title: string } | null;
};

function useBolos() {
  return useQuery({
    queryKey: ["bolos"],
    queryFn: async (): Promise<Bolo[]> => {
      const { data, error } = await supabase
        .from("bolos")
        .select("id, title, fecha, setlist_ids, archived")
        .eq("archived", false)
        .order("fecha", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Bolo[];
    },
  });
}

function useUpdateBolo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Bolo> }) => {
      const { error } = await supabase.from("bolos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      qc.setQueryData<Bolo[]>(["bolos"], (old) =>
        old?.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["bolos"] }),
    onError: () => toast.error("No se pudo guardar"),
  });
}

function fmtDate(d: string | null) {
  if (!d) return "Sin fecha";
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function BoloMode() {
  const bolos = useBolos();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [fecha, setFecha] = useState("");
  const open = bolos.data?.find((b) => b.id === openId) ?? null;

  async function create() {
    if (!title.trim()) return;
    const { data, error } = await supabase
      .from("bolos")
      .insert({ title: title.trim(), fecha: fecha || null })
      .select("id")
      .single();
    if (error) {
      toast.error("No se pudo crear el bolo");
      return;
    }
    setCreating(false);
    setTitle("");
    setFecha("");
    await qc.invalidateQueries({ queryKey: ["bolos"] });
    setOpenId(data.id);
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="section-label">Modo Bolo</h2>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo bolo
        </button>
      </div>
      {(bolos.data ?? []).length === 0 ? (
        <p className="glass rounded-2xl p-4 text-sm text-muted-foreground">
          No hay bolos preparados.
        </p>
      ) : (
        <div className="group-list">
          {bolos.data!.map((b) => (
            <button
              key={b.id}
              onClick={() => setOpenId(b.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <Music2 className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{b.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {fmtDate(b.fecha)} · {b.setlist_ids.length} setlist
                  {b.setlist_ids.length === 1 ? "" : "s"}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo bolo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nombre (p. ej. Fiestas de Xàtiva)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <Button className="w-full" onClick={create} disabled={!title.trim()}>
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-h-[88svh] overflow-y-auto">
          {open && <BoloDetail bolo={open} onClose={() => setOpenId(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BoloDetail({ bolo, onClose }: { bolo: Bolo; onClose: () => void }) {
  const setlists = useSetlists();
  const lyrics = useLyrics();
  const update = useUpdateBolo();
  const [picking, setPicking] = useState(bolo.setlist_ids.length === 0);
  const [viewing, setViewing] = useState<{ title: string; lyric: Lyric } | null>(null);

  const active = useMemo(
    () => (setlists.data ?? []).filter((s) => !parseSetlistNotes(s.notes).archived),
    [setlists.data],
  );
  const chosen = useMemo(
    () =>
      bolo.setlist_ids
        .map((id) => (setlists.data ?? []).find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s),
    [bolo.setlist_ids, setlists.data],
  );

  const items = useQuery({
    queryKey: ["bolo_items", bolo.setlist_ids.join(",")],
    enabled: bolo.setlist_ids.length > 0,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("setlist_items")
        .select("id, setlist_id, position, arrangement_id, manual_title, arrangements(title)")
        .in("setlist_id", bolo.setlist_ids)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });

  const lyricFor = (arrangementId: string | null): Lyric | null =>
    arrangementId
      ? ((lyrics.data ?? []).find(
          (l) => l.kind === "arreglo" && l.arrangement_id === arrangementId,
        ) ?? null)
      : null;

  function toggleSetlist(id: string) {
    const next = bolo.setlist_ids.includes(id)
      ? bolo.setlist_ids.filter((x) => x !== id)
      : [...bolo.setlist_ids, id];
    update.mutate({ id: bolo.id, patch: { setlist_ids: next } });
  }

  function openLyric(item: Item) {
    const title = item.arrangements?.title ?? item.manual_title ?? "Sin título";
    const lyric = lyricFor(item.arrangement_id);
    if (!lyric) {
      toast.info(`«${title}» no tiene letra guardada`);
      return;
    }
    haptic("light");
    setViewing({ title, lyric });
  }

  return (
    <div className="min-w-0 space-y-4">
      <DialogHeader>
        <DialogTitle className="truncate">{bolo.title}</DialogTitle>
        <p className="text-xs text-muted-foreground">
          {fmtDate(bolo.fecha)} · {chosen.length} setlist{chosen.length === 1 ? "" : "s"} ·{" "}
          {items.data?.length ?? 0} canciones
        </p>
      </DialogHeader>

      <div className="flex gap-2">
        <Link
          to="/partituras"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm font-bold"
        >
          <FileMusic className="h-4 w-4" /> Partituras
        </Link>
        <button
          onClick={() => setPicking((v) => !v)}
          className="flex-1 rounded-xl bg-secondary px-3 py-2.5 text-sm font-bold"
        >
          {picking ? "Listo" : "Setlists"}
        </button>
      </div>

      {picking && (
        <div className="group-list">
          {active.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No hay setlists vigentes.</p>
          )}
          {active.map((s) => {
            const on = bolo.setlist_ids.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggleSetlist(s.id)}
                className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {chosen.map((s) => {
        const list = (items.data ?? []).filter((i) => i.setlist_id === s.id);
        return (
          <div key={s.id} className="space-y-1.5">
            <h3 className="section-label truncate">{s.name}</h3>
            <div className="group-list">
              {list.map((i, n) => {
                const lyric = lyricFor(i.arrangement_id);
                return (
                  <button
                    key={i.id}
                    onClick={() => openLyric(i)}
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left"
                  >
                    <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">
                      {n + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {i.arrangements?.title ?? i.manual_title ?? "Sin título"}
                    </span>
                    <FileText
                      className={`h-4 w-4 shrink-0 ${lyric ? "text-primary" : "text-muted-foreground/40"}`}
                    />
                  </button>
                );
              })}
              {list.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Setlist vacío.</p>
              )}
            </div>
          </div>
        );
      })}

      <button
        onClick={() => {
          update.mutate({ id: bolo.id, patch: { archived: true } });
          onClose();
        }}
        className="flex w-full items-center justify-center gap-2 py-2 text-xs font-bold text-muted-foreground"
      >
        <Archive className="h-3.5 w-3.5" /> Archivar bolo
      </button>

      {viewing && (
        <LyricViewerModal
          title={viewing.title}
          kind="arreglo"
          lyric={viewing.lyric}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
