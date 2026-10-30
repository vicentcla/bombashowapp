import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Library, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePendingCount, useTabOrder } from "@/lib/queries";
import { DESKTOP_NAV, orderNav, type NavTo } from "@/lib/nav";
import { useGlobalRealtime } from "@/hooks/useGlobalRealtime";
import { PullToRefresh } from "@/components/PullToRefresh";
import { TunerMetronome } from "@/components/TunerMetronome";
import { InstallInvite } from "@/components/InstallApp";

const LOGO_SRC = "/logo-titulo-2.png";

const BAR_LIMIT = 4;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const pendingCountQuery = usePendingCount();
  const pendingCount = isAdmin ? (pendingCountQuery.data ?? 0) : 0;

  useGlobalRealtime();

  const tabOrderQuery = useTabOrder(user?.id);
  const orderedNav = useMemo(
    () => orderNav(tabOrderQuery.data as NavTo[] | undefined),
    [tabOrderQuery.data],
  );
  const barNav = orderedNav.slice(0, BAR_LIMIT);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const slots = barNav.length + 1;
  const activeIndex = pathname.startsWith("/centro")
    ? barNav.length
    : barNav.findIndex((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));

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
      <header className="glass-strong sticky top-0 z-40 rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top)] shadow-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/inicio" className="shrink-0 min-w-0">
              <img
                src={LOGO_SRC}
                alt="La Bomba Show Xaranga"
                className="h-9 w-auto object-contain md:h-11"
              />
            </Link>
            <TunerMetronome />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />

            {/* Iconos de escritorio: repertorio y ajustes van al centro de control en móvil */}
            <div className="hidden items-center gap-1.5 sm:gap-2 md:flex">
              <Link
                to="/repertorio"
                search={{ tab: "calle", editLyricId: undefined }}
                className="comic-sm comic-press flex items-center justify-center rounded-full p-2.5 text-foreground"
                aria-label="Repertorio"
              >
                <Library className="h-5 w-5 shrink-0" />
              </Link>

              <Link
                to="/centro"
                search={{ tab: isAdmin ? "gestion" : "perfil" }}
                className="comic-sm comic-press relative flex items-center justify-center rounded-full p-2.5 text-foreground"
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
              className="comic-press flex items-center justify-center rounded-full bg-secondary p-2.5 text-destructive"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-5 w-5 shrink-0" />
            </button>
          </div>
        </div>
      </header>
      <InstallInvite />

      <div className="mx-auto flex w-full max-w-6xl">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="glass sticky top-24 m-4 mr-0 flex flex-col gap-0.5 rounded-3xl p-2">
            {DESKTOP_NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "bg-primary/12 text-primary" }}
                inactiveProps={{
                  className: "text-muted-foreground hover:bg-accent hover:text-foreground",
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors"
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <PullToRefresh>
            <main className="mx-auto w-full max-w-5xl overflow-x-hidden px-3 py-4 sm:px-4 md:py-6">
              {children}
            </main>
          </PullToRefresh>
        </div>
      </div>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-5 pb-[max(env(safe-area-inset-bottom),0.9rem)] md:hidden">
        <div className="liquid pointer-events-auto relative mx-auto flex max-w-[22rem] items-center rounded-full p-1.5">
          {activeIndex >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-1.5 rounded-full bg-primary/15 shadow-[inset_0_1px_0_0_var(--glass-border)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: `calc((100% - 0.75rem) / ${slots})`,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            />
          )}
          {barNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              activeProps={{ className: "text-primary [&>svg]:scale-110" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-full py-3 transition-colors duration-200 active:scale-90"
            >
              <Icon className="h-[22px] w-[22px] shrink-0 transition-transform duration-300" />
            </Link>
          ))}

          <Link
            to="/centro"
            search={{ tab: "paginas" }}
            aria-label="Más"
            title="Más"
            activeProps={{ className: "text-primary [&>svg]:scale-110" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-full py-3 transition-colors duration-200 active:scale-90"
          >
            <LayoutGrid className="h-[22px] w-[22px] shrink-0 transition-transform duration-300" />
          </Link>
        </div>
      </nav>
    </div>
  );
}
