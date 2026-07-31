import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Counters } from "@/components/Counters";
import { useArrangements, useLyrics } from "@/lib/queries";
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
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of arrangements.data ?? []) for (const t of a.tags ?? []) set.add(t);
    return [...set].sort();
  }, [arrangements.data]);

  const items = useMemo(
    () =>
      (arrangements.data ?? [])
        .filter((a) => !tag || (a.tags ?? []).includes(tag))
        .map((a) => ({
          id: a.id,
          title: a.title,
          subtitle: formatDuration(a.duration_seconds),
          tags: a.tags ?? [],
        })),
    [arrangements.data, tag],
  );

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

      <Counters scope="arrangement" search={search} items={items} />

      <details className="comic mt-6 rounded-xl bg-card p-4">
        <summary className="cursor-pointer text-xl">Letras de los arreglos</summary>
        <div className="mt-3 space-y-3">
          {(lyrics.data ?? [])
            .filter((l) => l.kind === "arrangement")
            .map((l) => (
              <details key={l.id} className="comic-sm rounded-md bg-background p-3">
                <summary className="cursor-pointer font-bold">{l.title}</summary>
                <div
                  className="lyrics-body mt-2 text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: l.content }}
                />
              </details>
            ))}
          {!lyrics.data?.some((l) => l.kind === "arrangement") && (
            <p className="text-muted-foreground">Todavía no hay letras de arreglos.</p>
          )}
        </div>
      </details>
    </div>
  );
}
