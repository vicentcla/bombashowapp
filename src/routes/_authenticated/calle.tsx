import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Counters } from "@/components/Counters";
import { useStreetSongs, useInvalidate } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/calle")({
  head: () => ({
    meta: [
      { title: "Contadores de calle — La Bomba Show" },
      {
        name: "description",
        content: "Cuenta las veces que se toca cada canción de calle durante las fiestas.",
      },
      { property: "og:title", content: "Contadores de calle — La Bomba Show" },
      {
        property: "og:description",
        content: "Cuenta las veces que se toca cada canción de calle durante las fiestas.",
      },
    ],
  }),
  component: Calle,
});

function Calle() {
  const songs = useStreetSongs();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function add() {
    if (!title.trim()) return;
    const { error } = await supabase.from("street_songs").insert({ title: title.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setAdding(false);
    invalidate("street_songs");
    toast.success("Canción añadida");
  }

  async function removeSong(id: string) {
    if (!confirm("¿Eliminar la canción y sus contadores?")) return;
    const { error } = await supabase.from("street_songs").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("street_songs", "play_events");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-4xl leading-none">Calle</h1>
        <button
          onClick={() => setAdding(true)}
          className="comic comic-press flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Añadir canción
        </button>
      </div>

      <div className="comic-sm mb-3 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar canción de calle…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
      </div>

      <Counters
        scope="street"
        search={search}
        items={(songs.data ?? []).map((s) => ({ id: s.id, title: s.title }))}
      />

      {!!songs.data?.length && (
        <details className="comic mt-6 rounded-xl bg-card p-4">
          <summary className="cursor-pointer text-xl">Gestionar canciones</summary>
          <ul className="mt-3 space-y-1">
            {songs.data.map((s) => (
              <li key={s.id} className="flex items-center gap-2 border-b border-border/40 py-1">
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <button
                  onClick={() => removeSong(s.id)}
                  aria-label={`Eliminar ${s.title}`}
                  className="comic-sm comic-press rounded bg-destructive p-1 text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div className="comic w-full max-w-sm rounded-xl bg-card p-4">
            <div className="mb-3 flex items-center">
              <h2 className="mr-auto text-2xl leading-none">Nueva canción de calle</h2>
              <button onClick={() => setAdding(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título"
              maxLength={120}
              className="comic-sm mb-3 w-full rounded-md bg-background px-3 py-2 outline-none"
            />
            <button
              onClick={add}
              className="comic comic-press w-full rounded-md bg-primary px-4 py-2 font-extrabold uppercase text-primary-foreground"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
