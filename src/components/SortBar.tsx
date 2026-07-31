import { ArrowDownAZ, ListOrdered, Flame, Clock } from "lucide-react";

export type SortMode = "alfabetico" | "manual" | "mas" | "duracion";

const ICONS = {
  alfabetico: ArrowDownAZ,
  manual: ListOrdered,
  mas: Flame,
  duracion: Clock,
} as const;

const LABELS = {
  alfabetico: "A-Z",
  manual: "Manual",
  mas: "Más tocadas",
  duracion: "Duración",
} as const;

export function SortBar({
  value,
  onChange,
  options,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  options: readonly SortMode[];
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs font-bold uppercase text-muted-foreground">Ordenar por</span>
      {options.map((mode) => {
        const Icon = ICONS[mode];
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={`comic-sm comic-press flex items-center gap-1 rounded px-2 py-1 text-xs font-bold uppercase ${
              value === mode ? "bg-primary text-primary-foreground" : "bg-card"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
