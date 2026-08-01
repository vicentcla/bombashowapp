import { Link, useNavigate } from "@tanstack/react-router";
import { Home, FileText, Clock, ListMusic, Library, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
const LOGO_SRC = "/logo-titulo-2.png";

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/letras", label: "Letras", icon: FileText },
  { to: "/contadores", label: "Contadores", icon: Clock },
  { to: "/setlists", label: "Setlists", icon: ListMusic },
  { to: "/repertorio", label: "Repertorio", icon: Library },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-6">
      {/* Cabecera: fluye con la página en móvil, sticky en escritorio */}
      <header className="border-b-[3px] border-ink bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur-md md:sticky md:top-0 md:z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <Link to="/inicio" className="shrink-0 min-w-0">
            <img
              src={LOGO_SRC}
              alt="La Bomba Show Xaranga"
              className="h-10 w-auto object-contain md:h-12"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
              inactiveProps={{
                className: "bg-secondary text-secondary-foreground hover:bg-accent",
              }}
              className="comic-sm comic-press flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-bold uppercase transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Contenido principal */}
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 md:py-6">{children}</main>

      {/* Barra de navegación inferior móvil — ventana flotante */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.625rem)] md:hidden">
        <div className="comic-sm mx-auto flex max-w-md items-center gap-0.5 rounded-2xl bg-card/95 px-1.5 py-1 backdrop-blur-md">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors active:scale-95"
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="w-full truncate text-center text-[9px] font-extrabold uppercase leading-none tracking-tight">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
