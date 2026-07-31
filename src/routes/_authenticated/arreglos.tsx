import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Counters, useCurrentCounts } from "@/components/Counters";
import { SortBar, type SortMode } from "@/components/SortBar";
import { useArrangements, useLyrics, useReorder } from "@/lib/queries";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/arreglos")({
  head: () => ({
    meta: [
      { title: "Contadores de arreglos — La Bomba Show" },
      {
        name: "description",
        content: "Contadores, etiquetas, duración y letras de los arreglos de la xaranga.",
      },
      { property: "og:title", content: "Contadores de arreglos — La Bomba Show" },
      {
        property: "og:description",
        content: "Contadores, etiquetas, duración y letras de los arreglos de la xaranga.",
      },
    ],
  }),
  component: Arreglos,
});

function Arreglos() {
  const arrangements = useArrangements();
  const lyrics = useLyrics();
  const counts = useCurrentCounts("arreglo");
  const reorder = useReorder("arrangements");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortMode>("alfabetico");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of arrangements.data ?? []) for (const t of a.tags ?? []) set.add(t);
    return [...set].sort();
  }, [arrangements.data]);

  const list = useMemo(() => {
    const base = (arrangements.data ?? []).filter((a) => !tag || (a.tags ?? []).includes(tag));
    const sorted = [...base];
    if (sort === "alfabetico") sorted.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "duracion") sorted.sort((a, b) => b.duration_seconds - a.duration_seconds);
    if (sort === "mas")
      sorted.sort(
        (a, b) =>
          (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.title.localeCompare(b.title, "es"),
      );
    if (sort === "manual") sorted.sort((a, b) => a.sort_order - b.sort_order);
    return sorted;
  }, [arrangements.data, tag, sort, counts]);

  const items = useMemo(
    () =>
      list.map((a) => ({
        id: a.id,
        title: a.title,
        subtitle: formatDuration(a.duration_seconds),
        tags: a.tags ?? [],
      })),
    [list],
  );

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((a) => a.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved!);
    reorder.mutate(ids);
  }

  return (
    <div>
      <h1 className="mb-4 text-4xl leading-none">Arreglos</h1>

      <div className="comic-sm mb-3 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título o etiqueta…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
      </div>

      <SortBar
        value={sort}
        onChange={setSort}
        options={["alfabetico", "mas", "duracion", "manual"]}
      />

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

      <Counters
        scope="arreglo"
        search={search}
        items={items}
        {...(sort === "manual" ? { onMove: move } : {})}
      />

      <details className="comic mt-6 rounded-xl bg-card p-4">
        <summary className="cursor-pointer text-xl">Letras de los arreglos</summary>
        <div className="mt-3 space-y-3">
          {(lyrics.data ?? [])
            .filter((l) => l.kind === "arreglo")
            .map((l) => (
              <details key={l.id} className="comic-sm rounded-md bg-background p-3">
                <summary className="cursor-pointer font-bold">{l.title}</summary>
                <div
                  className="lyrics-body mt-2 text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: l.content }}
                />
              </details>
            ))}
          {!lyrics.data?.some((l) => l.kind === "arreglo") && (
            <p className="text-muted-foreground">Todavía no hay letras de arreglos.</p>
          )}
        </div>
      </details>
    </div>
  );
}
