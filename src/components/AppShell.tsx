import { Link, useNavigate } from "@tanstack/react-router";
import { Music, ListMusic, Megaphone, Drum, Users, LogOut, Home } from "lucide-react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import bannerAsset from "@/assets/banner.png.asset.json";

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/letras", label: "Letras", icon: Music },
  { to: "/repertorio", label: "Repertorio", icon: ListMusic },
  { to: "/calle", label: "Calle", icon: Megaphone },
  { to: "/arreglos", label: "Arreglos", icon: Drum },
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
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b-[3px] border-ink bg-card">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2">
          <Link to="/inicio" className="min-w-0">
            <img
              src={bannerAsset.url}
              alt="La Bomba Show Xaranga"
              className="h-10 w-auto max-w-full object-contain md:h-12"
            />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              to="/miembros"
              className="comic-sm comic-press hidden rounded-md bg-secondary p-2 text-secondary-foreground md:inline-flex"
              aria-label="Miembros"
            >
              <Users className="h-4 w-4" />
            </Link>
            <button
              onClick={signOut}
              className="comic-sm comic-press rounded-md bg-destructive p-2 text-destructive-foreground"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-2 px-4 pb-2 md:flex">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              inactiveProps={{ className: "bg-secondary text-secondary-foreground" }}
              className="comic-sm comic-press flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold uppercase"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-ink bg-card md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-1 py-2 text-[11px] font-bold uppercase"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
