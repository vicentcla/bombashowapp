import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Clock, Megaphone, Drum, Search } from "lucide-react";
import { Counters, useCurrentCounts } from "@/components/Counters";
import { SortBar, type SortMode } from "@/components/SortBar";
import { useStreetSongs, useArrangements, useReorder } from "@/lib/queries";
import { formatDuration } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contadores")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search['tab'] === "arreglos" ? "arreglos" : ("calle" as "calle" | "arreglos"),
  }),
  head: () => ({
    meta: [
      { title: "Contadores — La Bomba Show" },
      {
        name: "description",
        content: "Cuenta las veces que se toca cada canción de calle y cada arreglo durante las fiestas.",
      },
      { property: "og:title", content: "Contadores — La Bomba Show" },
      {
        property: "og:description",
        content: "Cuenta las veces que se toca cada canción de calle y cada arreglo durante las fiestas.",
      },
    ],
  }),
  component: Contadores,
});

function Contadores() {
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"calle" | "arreglos">(
    search['tab'] === "arreglos" ? "arreglos" : "calle"
  );

  const handleTabChange = (newTab: "calle" | "arreglos") => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-4xl leading-none">Contadores</h1>
        </div>
      </div>

      <div className="comic-sm mb-4 flex overflow-hidden rounded-md bg-card p-1">
        <button
          type="button"
          onClick={() => handleTabChange("calle")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
            activeTab === "calle"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Megaphone className="h-4 w-4" />
          Calle
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("arreglos")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
            activeTab === "arreglos"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Drum className="h-4 w-4" />
          Arreglos
        </button>
      </div>

      {activeTab === "calle" ? <ContadoresCalle /> : <ContadoresArreglos />}
    </div>
  );
}

function ContadoresCalle() {
  const songs = useStreetSongs();
  const counts = useCurrentCounts("calle");
  const reorder = useReorder("street_songs");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("alfabetico");

  const list = useMemo(() => {
    const sorted = [...(songs.data ?? [])];
    if (sort === "alfabetico") sorted.sort((a, b) => a.title.localeCompare(b.title, "es"));
    if (sort === "mas")
      sorted.sort(
        (a, b) =>
          (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.title.localeCompare(b.title, "es"),
      );
    if (sort === "manual") sorted.sort((a, b) => a.sort_order - b.sort_order);
    return sorted;
  }, [songs.data, sort, counts]);

  function handleReorder(newItems: { id: string; title: string }[]) {
    reorder.mutate(newItems.map((i) => i.id));
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Canciones de calle</h2>
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

      <SortBar value={sort} onChange={setSort} options={["alfabetico", "mas", "manual"]} />

      <Counters
        scope="calle"
        search={search}
        items={list.map((s) => ({ id: s.id, title: s.title }))}
        {...(sort === "manual" ? { onReorder: handleReorder } : {})}
      />
    </div>
  );
}

function ContadoresArreglos() {
  const arrangements = useArrangements();
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

  function handleReorder(newItems: { id: string }[]) {
    reorder.mutate(newItems.map((i) => i.id));
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Arreglos</h2>
      </div>

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
        {...(sort === "manual" ? { onReorder: handleReorder } : {})}
      />
    </div>
  );
}
