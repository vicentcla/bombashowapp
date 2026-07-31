import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home,
  FileText,
  Clock,
  ListOrdered,
  Library,
  LogOut,
  Gamepad2,
  Settings,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import bannerAsset from "@/assets/banner.png.asset.json";

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/letras", label: "Letras", icon: FileText },
  { to: "/contadores", label: "Contadores", icon: Clock },
  { to: "/setlists", label: "Setlists", icon: ListOrdered },
  { to: "/repertorio", label: "Repertorio", icon: Library },
] as const;

const GAME_URL = "https://aythor.itch.io/la-bomba-show-runner";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estado para la ocultación suave de la cabecera al hacer scroll hacia abajo en móvil
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 20) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Hacia abajo -> Ocultar cabecera superior en móvil
        setShowHeader(false);
      } else if (currentScrollY < lastScrollY) {
        // Hacia arriba -> Mostrar cabecera
        setShowHeader(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-6">
      {/* Cabecera superior con efecto Glassmorphism y ocultación en scroll */}
      <header
        className={`fixed top-0 inset-x-0 z-40 border-b-[3px] border-ink bg-card/95 backdrop-blur-md transition-transform duration-300 ease-in-out md:sticky md:translate-y-0 ${
          showHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <Link to="/inicio" className="shrink-0 min-w-0">
            <img
              src={bannerAsset.url}
              alt="La Bomba Show Xaranga"
              className="h-9 w-auto max-w-[150px] object-contain sm:max-w-none md:h-11"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href={GAME_URL}
              target="_blank"
              rel="noreferrer"
              className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-2 text-xs font-extrabold uppercase text-accent-foreground"
            >
              <Gamepad2 className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">Juego</span>
            </a>

            <ThemeToggle />

            <Link
              to="/ajustes"
              className="comic-sm comic-press flex items-center justify-center rounded-lg bg-secondary p-2 text-secondary-foreground"
              aria-label="Ajustes de usuario"
            >
              <Settings className="h-5 w-5 shrink-0" />
            </Link>

            <button
              onClick={signOut}
              className="comic-sm comic-press flex items-center justify-center rounded-lg bg-destructive p-2 text-destructive-foreground"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Navegación escritorio */}
        <nav className="mx-auto hidden max-w-5xl flex-wrap gap-2 px-4 pb-2 md:flex">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              inactiveProps={{ className: "bg-secondary text-secondary-foreground hover:bg-accent" }}
              className="comic-sm comic-press flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-bold uppercase transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Contenido principal con compensación de altura de cabecera fija en móvil */}
      <main className="mx-auto max-w-5xl px-3 pt-16 sm:px-4 md:pt-6">{children}</main>

      {/* Barra de navegación inferior móvil tipo App Nativa */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-card/95 backdrop-blur-md shadow-2xl md:hidden">
        <div className="grid grid-cols-5 items-center px-1 py-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "text-primary scale-105" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-95"
            >
              <div className="comic-sm flex items-center justify-center rounded-lg p-1">
                <Icon className="h-5 w-5 shrink-0" />
              </div>
              <span className="leading-none text-[10px] font-extrabold uppercase tracking-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
