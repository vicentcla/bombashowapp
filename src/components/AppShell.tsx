import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Library, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePendingCount, useTabOrder } from "@/lib/queries";
import { BAR_LIMIT, DEFAULT_BAR_COUNT, DESKTOP_NAV, orderNav, type NavTo } from "@/lib/nav";
const LOGO_SRC = "/logo-titulo-2.png";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const pendingCountQuery = usePendingCount();
  const pendingCount = isAdmin ? (pendingCountQuery.data ?? 0) : 0;

  const tabOrderQuery = useTabOrder(user?.id);
  const orderedNav = useMemo(
    () => orderNav(tabOrderQuery.data as NavTo[] | undefined),
    [tabOrderQuery.data],
  );
  const hasCustomOrder = !!tabOrderQuery.data && tabOrderQuery.data.length > 0;
  const barCount = Math.min(BAR_LIMIT, orderedNav.length);
  const barLimit = hasCustomOrder ? barCount : Math.min(DEFAULT_BAR_COUNT, barCount);
  const barNav = orderedNav.slice(0, barLimit);
  const hasFiveTabs = barLimit === 5;
  const barItemClass = hasFiveTabs ? "py-2" : "py-2.5";
  const barIconClass = hasFiveTabs ? "h-5 w-5" : "h-6 w-6";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
    }
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  }

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-8">
      {/* Cabecera: fluye con la página en móvil, sticky en escritorio */}
      <header className="glass-strong rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top)] md:sticky md:top-0 md:z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
          <Link to="/inicio" className="shrink-0 min-w-0">
            <img
              src={LOGO_SRC}
              alt="La Bomba Show Xaranga"
              className="h-10 w-auto object-contain md:h-12"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />

            {/* Iconos de escritorio: repertorio y ajustes van al centro de control en móvil */}
            <div className="hidden items-center gap-1.5 sm:gap-2 md:flex">
              <Link
                to="/repertorio"
                search={{ tab: "calle", editLyricId: undefined }}
                className="comic-sm comic-press flex items-center justify-center rounded-xl p-2.5 text-foreground"
                aria-label="Repertorio"
              >
                <Library className="h-5 w-5 shrink-0" />
              </Link>

              <Link
                to="/centro"
                search={{ tab: isAdmin ? "gestion" : "perfil" }}
                className="comic-sm comic-press relative flex items-center justify-center rounded-xl p-2.5 text-foreground"
                aria-label="Centro de control"
              >
                <Settings className="h-5 w-5 shrink-0" />
                {pendingCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold leading-none text-destructive-foreground shadow-[0_0_0_2px_var(--background),0_4px_12px_-4px_var(--destructive)]">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
            </div>

            <button
              onClick={signOut}
              className="comic-press flex items-center justify-center rounded-xl bg-destructive p-2.5 text-destructive-foreground shadow-[0_6px_18px_-8px_var(--destructive)]"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Navegación escritorio */}
        <nav className="mx-auto hidden max-w-5xl flex-wrap gap-1.5 px-4 pb-2.5 md:flex">
          {DESKTOP_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{
                className:
                  "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]",
              }}
              inactiveProps={{
                className: "text-muted-foreground hover:bg-accent hover:text-foreground",
              }}
              className="comic-press flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Contenido principal */}
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 md:py-6">{children}</main>

      {/* Barra de navegación inferior móvil — dock flotante de cristal */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden">
        <div className="glass-strong mx-auto flex max-w-md items-center gap-0.5 rounded-[1.75rem] px-1.5 py-1.5">
          {barNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              activeProps={{
                className:
                  "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]",
              }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className={`flex min-w-0 flex-1 items-center justify-center rounded-[1.25rem] ${barItemClass} transition-all duration-200 active:scale-90`}
            >
              <Icon className={`${barIconClass} shrink-0`} />
            </Link>
          ))}

          <Link
            to="/centro"
            search={{ tab: "paginas" }}
            aria-label="Más"
            title="Más"
            activeProps={{
              className:
                "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]",
            }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-[1.25rem] ${barItemClass} transition-all duration-200 active:scale-90`}
          >
            <LayoutGrid className={`${barIconClass} shrink-0`} />
          </Link>
        </div>
      </nav>
    </div>
  );
}
