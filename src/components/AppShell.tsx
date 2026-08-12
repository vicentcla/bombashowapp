import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home,
  FileText,
  Clock,
  ListMusic,
  Library,
  Instagram,
  LogOut,
  Settings,
  Megaphone,
} from "lucide-react";
import { GoogleDriveIcon } from "@/components/BrandIcons";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
const LOGO_SRC = "/logo-titulo-2.png";

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/letras", label: "Letras", icon: FileText },
  { to: "/contadores", label: "Contadores", icon: Clock },
  { to: "/setlists", label: "Setlists", icon: ListMusic },
  { to: "/bolo", label: "Bolo", icon: Megaphone },
  { to: "/partituras", label: "Partituras", icon: GoogleDriveIcon },
  { to: "/social", label: "Redes", icon: Instagram },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();

  const pendingUsersQuery = useQuery({
    queryKey: ["pending-admin-badge"],
    enabled: isAdmin,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [profilesRes, requestsRes, setlistsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("role_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("setlists").select("notes"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (setlistsRes.error) throw setlistsRes.error;

      let proposals = 0;
      for (const row of setlistsRes.data ?? []) {
        try {
          const parsed = JSON.parse(row.notes ?? "");
          for (const p of parsed?.proposals ?? []) {
            if (p?.status === "pending") proposals += 1;
          }
        } catch {
          // notes en texto plano: sin propuestas
        }
      }

      return (profilesRes.count ?? 0) + (requestsRes.count ?? 0) + proposals;
    },
  });
  const pendingUsers = isAdmin ? (pendingUsersQuery.data ?? 0) : 0;

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

            <Link
              to="/repertorio"
              search={{ tab: "calle", editLyricId: undefined }}
              className="comic-sm comic-press flex items-center justify-center rounded-xl p-2.5 text-foreground"
              aria-label="Repertorio"
            >
              <Library className="h-5 w-5 shrink-0" />
            </Link>

            <Link
              to="/ajustes"
              className="comic-sm comic-press relative flex items-center justify-center rounded-xl p-2.5 text-foreground"
              aria-label="Ajustes de usuario"
            >
              <Settings className="h-5 w-5 shrink-0" />
              {pendingUsers > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold leading-none text-destructive-foreground shadow-[0_0_0_2px_var(--background),0_4px_12px_-4px_var(--destructive)]">
                  {pendingUsers > 99 ? "99+" : pendingUsers}
                </span>
              )}
            </Link>

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
          {NAV.map(({ to, label, icon: Icon }) => (
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
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{
                className:
                  "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)]",
              }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] py-1.5 transition-all duration-200 active:scale-90"
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
