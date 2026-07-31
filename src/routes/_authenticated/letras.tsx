import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLyrics, type Scope } from "@/lib/queries";
import { normalize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/letras")({
  head: () => ({
    meta: [
      { title: "Letras — La Bomba Show" },
      {
        name: "description",
        content: "Buscador de letras de calle y de arreglos de La Bomba Show Xaranga.",
      },
      { property: "og:title", content: "Letras — La Bomba Show" },
      {
        property: "og:description",
        content: "Buscador de letras de calle y de arreglos de La Bomba Show Xaranga.",
      },
    ],
  }),
  component: Letras,
});

function Letras() {
  const [kind, setKind] = useState<Scope>("calle");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const lyrics = useLyrics();

  const list = useMemo(() => {
    const q = normalize(query.trim());
    return (lyrics.data ?? [])
      .filter((l) => l.kind === kind)
      .filter(
        (l) => !q || normalize(l.title).includes(q) || normalize(l.plain_text).includes(q),
      )
      .sort((a, b) => a.title.localeCompare(b.title, "es"));
  }, [lyrics.data, kind, query]);

  return (
    <div>
      <h1 className="mb-4 text-4xl leading-none">Letras</h1>

      <div className="comic-sm mb-3 flex overflow-hidden rounded-md">
        {(
          [
            ["calle", "Calle"],
            ["arreglo", "Arreglos"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className={`flex-1 px-3 py-2 text-sm font-extrabold uppercase ${
              kind === value ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="comic-sm mb-3 flex items-center gap-2 rounded-md bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título o por texto de la letra…"
          className="w-full bg-transparent py-2 text-base outline-none"
        />
      </div>

      <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
        Las letras se crean y editan desde Repertorio (arreglos) y desde Calle.
      </p>

      {list.length === 0 && (
        <p className="comic rounded-xl bg-card p-4 text-muted-foreground">
          No hay letras que coincidan con la búsqueda.
        </p>
      )}

      <div className="space-y-2">
        {list.map((l) => (
          <div key={l.id} className="comic rounded-xl bg-card p-3">
            <button
              onClick={() => setOpenId(openId === l.id ? null : l.id)}
              className="w-full text-left text-xl leading-tight"
            >
              {l.title}
            </button>
            {openId === l.id && (
              <div
                className="lyrics-body mt-2 text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: l.content }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
