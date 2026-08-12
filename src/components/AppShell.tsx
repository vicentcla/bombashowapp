import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Library, LogOut, RefreshCw, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePendingCount, useTabOrder } from "@/lib/queries";
import { BAR_LIMIT, DEFAULT_BAR_COUNT, DESKTOP_NAV, orderNav, type NavTo } from "@/lib/nav";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useScrollDirection } from "@/hooks/useScrollDirection";
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

  const { pullY, refreshing, threshold } = usePullToRefresh();
  const pullProgress = Math.min(pullY / threshold, 1);
  const isActivated = pullY >= threshold;

  const scrollDir = useScrollDirection();
  // La barra se encoge al bajar o en idle; se expande al subir o al tocar
  const [navTapped, setNavTapped] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShrunk = !navTapped && (scrollDir === "down" || scrollDir === "idle");

  function handleNavTap() {
    setNavTapped(true);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setNavTapped(false), 2200);
  }

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

      {/* Contenido principal — se desplaza suavemente al hacer pull */}
      <main
        className="mx-auto max-w-5xl px-3 py-4 sm:px-4 md:py-6"
        style={pullY > 0 ? { transform: `translateY(${pullY}px)`, transition: "none" } : {}}
      >
        {children}
      </main>

      {/* Indicador visual de Pull-to-Refresh — sólo móvil */}
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all md:hidden"
          style={{ transform: `translateY(calc(${Math.min(pullY, 80)}px - 100%))`, opacity: refreshing ? 1 : pullProgress }}
        >
          <div
            className={`mt-2 flex h-11 w-11 items-center justify-center rounded-full shadow-xl border border-border/40 ${
              isActivated || refreshing ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            <RefreshCw
              className={`h-5 w-5 ${
                refreshing ? "animate-spin" : ""
              }`}
              style={!refreshing ? { transform: `rotate(${pullProgress * 360}deg)` } : {}}
            />
          </div>
        </div>
      )}

      {/* Barra de navegación inferior móvil — dock liquid glass adaptativo */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),0.6rem)] md:hidden"
        onPointerDown={handleNavTap}
      >
        <div
          className={`flex items-center gap-0.5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isShrunk
              ? "rounded-[2rem] px-1 py-0.5 max-w-[52vw]"
              : "rounded-[1.6rem] px-1.5 py-1 max-w-[88vw] w-full"
          }`}
          style={{
            background: isShrunk
              ? "rgba(255,255,255,0.08)"
              : "rgba(255,255,255,0.12)",
            backdropFilter: "blur(28px) saturate(200%) brightness(1.08)",
            WebkitBackdropFilter: "blur(28px) saturate(200%) brightness(1.08)",
            border: "1px solid rgba(255,255,255,0.22)",
            boxShadow: isShrunk
              ? "0 2px 16px -4px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)"
              : "0 8px 32px -8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 0.5px rgba(255,255,255,0.08)",
          }}
        >
          {barNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              activeProps={{
                className:
                  "bg-primary/90 text-primary-foreground shadow-[0_4px_16px_-6px_var(--primary)]",
              }}
              inactiveProps={{ className: "text-white/60 dark:text-white/50" }}
              className={`flex min-w-0 flex-1 items-center justify-center rounded-[1.2rem] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-85 ${
                isShrunk ? "py-1.5" : "py-2"
              }`}
            >
              <Icon
                className={`shrink-0 transition-all duration-500 ${
                  isShrunk ? "h-4 w-4" : hasFiveTabs ? "h-5 w-5" : "h-5.5 w-5.5"
                }`}
              />
            </Link>
          ))}

          <Link
            to="/centro"
            search={{ tab: "paginas" }}
            aria-label="Más"
            title="Más"
            activeProps={{
              className:
                "bg-primary/90 text-primary-foreground shadow-[0_4px_16px_-6px_var(--primary)]",
            }}
            inactiveProps={{ className: "text-white/60 dark:text-white/50" }}
            className={`flex min-w-0 flex-1 items-center justify-center rounded-[1.2rem] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-85 ${
              isShrunk ? "py-1.5" : "py-2"
            }`}
          >
            <LayoutGrid
              className={`shrink-0 transition-all duration-500 ${
                isShrunk ? "h-4 w-4" : hasFiveTabs ? "h-5 w-5" : "h-5.5 w-5.5"
              }`}
            />
          </Link>
        </div>
      </nav>
    </div>
  );
}
