import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "lbs-theme";

// Color de la barra de estado de iOS (meta theme-color): igual al fondo de la cabecera.
const STATUS_BAR_COLORS: Record<"light" | "dark", string> = {
  light: "#f3f5f9",
  dark: "#1a1f2b",
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "auto",
  resolved: "light",
  setMode: () => {},
});

function apply(mode: ThemeMode): "light" | "dark" {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", STATUS_BAR_COLORS[resolved]);
  }
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "auto";
    setModeState(stored);
    setResolved(apply(stored));
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("auto"));
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    setResolved(apply(next));
  };

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Se inyecta en el <head> para aplicar el tema antes del primer pintado.
export const themeInitScript = `(function(){try{var m=localStorage.getItem('${STORAGE_KEY}')||'auto';var d=m==='dark'||(m==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute('content',d?'#1a1f2b':'#f3f5f9');}catch(e){}})();`;
