import { createFileRoute, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, User, Shield, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useTabOrder, useInvalidate, usePendingCount } from "@/lib/queries";
import { orderNav, type NavItem, type NavTo } from "@/lib/nav";
import { SortableList, SortableItem } from "@/components/SortableList";
import { ProfileSettings } from "@/components/ProfileSettings";
import { AdminManagement } from "@/components/AdminManagement";

export const Route = createFileRoute("/_authenticated/centro")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search["tab"] === "perfil" || search["tab"] === "gestion"
        ? search["tab"]
        : ("paginas" as "paginas" | "perfil" | "gestion"),
  }),
  head: () => ({
    meta: [
      { title: "Centro de control — La Bomba Show" },
      {
        name: "description",
        content:
          "Todas las pestañas de la app, tu perfil y la gestión de la charanga en un solo lugar.",
      },
    ],
  }),
  component: Centro,
});

type Section = "paginas" | "perfil" | "gestion";

const BAR_LIMIT = 4;

function Centro() {
  const search = Route.useSearch();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const invalidate = useInvalidate();
  const tabOrderQuery = useTabOrder(user?.id);
  const pendingQuery = usePendingCount();
  const pendingCount = isAdmin ? (pendingQuery.data ?? 0) : 0;
  const { pathname } = useLocation();

  const searchTab = search["tab"];

  const [activeSection, setActiveSection] = useState<Section>(searchTab);
  const [editing, setEditing] = useState(false);
  const [draftOrder, setDraftOrder] = useState<NavItem[] | null>(null);

  useEffect(() => {
    setActiveSection(searchTab);
  }, [searchTab]);

  const baseOrdered = useMemo(
    () => orderNav(tabOrderQuery.data as NavTo[] | undefined),
    [tabOrderQuery.data],
  );
  const ordered = draftOrder ?? baseOrdered;

  function startEditing() {
    setDraftOrder(ordered);
    setEditing(true);
  }

  async function saveOrder(nav: NavItem[]) {
    if (!user) return;
    const order = nav.map((n) => n.to);
    // tab_order no existe en los tipos generados de Supabase (migración nueva).
    const builder = supabase.from("profiles") as unknown as {
      update: (values: { tab_order: string[] }) => {
        eq: (col: string, val: string) => Promise<{ error: Error | null }>;
      };
    };
    const res = await builder.update({ tab_order: order }).eq("id", user.id);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    invalidate("profile-tab-order");
    toast.success("Orden de pestañas guardado");
  }

  function handleReorder(wrappers: { id: string }[]) {
    const nav = wrappers
      .map((w) => ordered.find((n) => n.to === w.id))
      .filter((n): n is NavItem => !!n);
    setDraftOrder(nav);
    void saveOrder(nav);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutGrid className="h-7 w-7 shrink-0 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-extrabold leading-none">Centro de control</h1>
          <p className="text-xs font-bold text-muted-foreground">
            Todas las pestañas de la app y tus ajustes
          </p>
        </div>
      </div>

      {/* Navegación por secciones */}
      <div className="comic-sm flex border-b border-border bg-card">
        <button
          onClick={() => setActiveSection("paginas")}
          className={`flex items-center gap-2 border-b-4 px-4 py-3 text-sm font-extrabold uppercase transition-all ${
            activeSection === "paginas"
              ? "border-primary bg-background text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Páginas
        </button>

        <button
          onClick={() => setActiveSection("perfil")}
          className={`flex items-center gap-2 border-b-4 px-4 py-3 text-sm font-extrabold uppercase transition-all ${
            activeSection === "perfil"
              ? "border-primary bg-background text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          Perfil
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSection("gestion")}
            className={`flex items-center gap-2 border-b-4 px-4 py-3 text-sm font-extrabold uppercase transition-all ${
              activeSection === "gestion"
                ? "border-primary bg-background text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" />
            Gestión
            {pendingCount > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-destructive px-1 text-[11px] font-extrabold leading-none text-destructive-foreground">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Sección: Páginas */}
      {activeSection === "paginas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-muted-foreground">
              {editing
                ? "Desliza para reordenar. Las 4 primeras aparecen en la barra inferior."
                : "Todas las pestañas de la app."}
            </p>
            {editing ? (
              <button
                onClick={() => {
                  setEditing(false);
                  setDraftOrder(null);
                }}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-extrabold uppercase text-primary-foreground"
              >
                <Check className="h-4 w-4" />
                Listo
              </button>
            ) : (
              <button
                onClick={startEditing}
                className="comic-sm comic-press flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-extrabold uppercase text-accent-foreground"
              >
                <Pencil className="h-4 w-4" />
                Editar orden
              </button>
            )}
          </div>

          {editing ? (
            <SortableList
              items={ordered.map((n) => ({ id: n.to }))}
              onReorder={handleReorder}
              strategy="vertical"
            >
              {(wrapper, index) => {
                const item = ordered.find((n) => n.to === wrapper.id);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <SortableItem key={item.to} id={item.to} className="mb-2" handleOnly>
                    <div
                      className={`comic-sm flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 ${
                        index < BAR_LIMIT ? "bg-background" : "bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-primary" />
                      <span className="flex-1 font-extrabold uppercase">{item.label}</span>
                      {index < BAR_LIMIT && (
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                          En la barra
                        </span>
                      )}
                    </div>
                  </SortableItem>
                );
              }}
            </SortableList>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ordered.map((item, index) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                const className = `comic-sm comic-press relative flex flex-col items-center gap-1.5 rounded-xl bg-card p-4 text-foreground transition-all active:scale-95 ${
                  active ? "ring-2 ring-primary" : ""
                }`;
                const content = (
                  <>
                    <Icon className="h-6 w-6 shrink-0" />
                    <span className="w-full truncate text-center text-xs font-extrabold uppercase leading-tight">
                      {item.label}
                    </span>
                    {index < BAR_LIMIT && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-extrabold uppercase leading-none text-primary">
                        Barra
                      </span>
                    )}
                  </>
                );
                return item.search ? (
                  <Link key={item.to} to={item.to} search={item.search} className={className}>
                    {content}
                  </Link>
                ) : (
                  <Link key={item.to} to={item.to} className={className}>
                    {content}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sección: Perfil */}
      {activeSection === "perfil" && <ProfileSettings />}

      {/* Sección: Gestión (solo admin) */}
      {activeSection === "gestion" && isAdmin && <AdminManagement />}
    </div>
  );
}
