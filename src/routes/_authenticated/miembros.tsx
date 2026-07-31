import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/miembros")({
  head: () => ({
    meta: [
      { title: "Miembros — La Bomba Show" },
      { name: "description", content: "Miembros con acceso a la app de La Bomba Show Xaranga." },
      { property: "og:title", content: "Miembros — La Bomba Show" },
      {
        property: "og:description",
        content: "Miembros con acceso a la app de La Bomba Show Xaranga.",
      },
    ],
  }),
  component: Miembros,
});

function Miembros() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h1 className="mb-4 text-4xl leading-none">Miembros</h1>

      <div className="comic mb-4 rounded-xl bg-card p-4">
        <p className="text-sm font-bold uppercase text-muted-foreground">Tu cuenta</p>
        <p className="text-xl">{user?.email}</p>
        <p className="text-sm font-bold text-muted-foreground">
          {isAdmin ? "Administrador" : "Miembro"}
        </p>
      </div>

      <div className="comic rounded-xl bg-card p-4">
        <h2 className="mb-2 text-2xl leading-none">Con acceso</h2>
        <ul className="space-y-1">
          {(profiles.data ?? []).map((p) => (
            <li key={p.id} className="border-b border-border/40 py-1">
              <span className="font-bold">{p.display_name || p.email}</span>
            </li>
          ))}
        </ul>
        {profiles.data?.length === 0 && (
          <p className="text-muted-foreground">Todavía no hay miembros registrados.</p>
        )}
      </div>
    </div>
  );
}
