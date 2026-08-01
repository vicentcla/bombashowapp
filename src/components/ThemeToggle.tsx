import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";

const CYCLE: ThemeMode[] = ["auto", "light", "dark"];

const META: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
  auto: { icon: Monitor, label: "Sistema" },
  light: { icon: Sun, label: "Claro" },
  dark: { icon: Moon, label: "Oscuro" },
};

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const next = CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length] ?? "auto";
  const { icon: Icon, label } = META[mode];

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={`Tema ${label}`}
      title={`Tema ${label} (siguiente: ${META[next].label})`}
      className="comic-sm comic-press flex items-center justify-center rounded-lg bg-secondary p-2 text-secondary-foreground"
    >
      <Icon className="h-5 w-5 shrink-0" />
    </button>
  );
}
