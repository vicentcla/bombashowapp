import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: "auto", icon: Monitor, label: "Automático" },
  { mode: "light", icon: Sun, label: "Claro" },
  { mode: "dark", icon: Moon, label: "Oscuro" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="comic-sm flex shrink-0 overflow-hidden rounded-md bg-secondary">
      {OPTIONS.map(({ mode: m, icon: Icon, label }) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-label={`Tema ${label}`}
          title={`Tema ${label}`}
          className={`p-2.5 ${
            mode === m ? "bg-primary text-primary-foreground" : "text-secondary-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
