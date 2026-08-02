import type { ReactNode } from "react";

export type TabStripTab<T extends string = string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

/**
 * Barra de pestañas con scroll horizontal: cada botón ocupa el mismo ancho si
 * caben todos; si se desbordan, la barra se puede deslizar.
 */
export function TabStrip<T extends string>({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: TabStripTab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`comic-sm no-scrollbar overflow-x-auto rounded-md bg-card p-1 ${className}`}
    >
      <div className="flex min-w-full gap-1">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={`flex min-w-max flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md py-2.5 text-sm font-extrabold uppercase transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
