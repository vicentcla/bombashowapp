import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useRoleRequests, useInvalidate } from "@/lib/queries";

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
  const requests = useRoleRequests();
  const invalidate = useInvalidate();

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

  const roles = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const myRequest = (requests.data ?? []).find((r) => r.user_id === user?.id);
  const pending = (requests.data ?? []).filter((r) => r.status === "pending");

  function nameOf(id: string) {
    const p = profiles.data?.find((x) => x.id === id);
    return p?.display_name || p?.email || id;
  }

  async function requestAdmin() {
    const { error } = await supabase.from("role_requests").insert({ user_id: user!.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("role_requests");
    toast.success("Solicitud enviada");
  }

  async function decide(requestId: string, userId: string, approve: boolean) {
    if (approve) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error && !error.message.includes("duplicate")) {
        toast.error(error.message);
        return;
      }
    }
    const { error } = await supabase
      .from("role_requests")
      .update({
        status: approve ? "approved" : "rejected",
        decided_by: user!.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("role_requests", "user_roles");
    toast.success(approve ? "Nuevo administrador" : "Solicitud rechazada");
  }

  return (
    <div>
      <h1 className="mb-4 text-4xl leading-none">Miembros</h1>

      <div className="comic mb-4 rounded-xl bg-card p-4">
        <p className="text-sm font-bold uppercase text-muted-foreground">Tu cuenta</p>
        <p className="text-xl">{user?.email}</p>
        <p className="text-sm font-bold text-muted-foreground">
          {isAdmin ? "Administrador" : "Miembro"}
        </p>
        {!isAdmin &&
          (myRequest?.status === "pending" ? (
            <p className="mt-2 text-sm font-bold">Solicitud de administrador pendiente.</p>
          ) : (
            <button
              onClick={requestAdmin}
              className="comic comic-press mt-3 rounded-md bg-primary px-3 py-2 text-sm font-extrabold uppercase text-primary-foreground"
            >
              Solicitar ser administrador
            </button>
          ))}
      </div>

      {isAdmin && (
        <div className="comic mb-4 rounded-xl bg-card p-4">
          <h2 className="mb-2 text-2xl leading-none">Solicitudes pendientes</h2>
          {pending.length === 0 && <p className="text-muted-foreground">No hay solicitudes.</p>}
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="mr-auto font-bold">{nameOf(r.user_id)}</span>
                <button
                  onClick={() => decide(r.id, r.user_id, true)}
                  className="comic-sm comic-press rounded bg-primary px-2 py-1 text-xs font-bold uppercase text-primary-foreground"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => decide(r.id, r.user_id, false)}
                  className="comic-sm comic-press rounded bg-destructive px-2 py-1 text-xs font-bold uppercase text-destructive-foreground"
                >
                  Rechazar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="comic rounded-xl bg-card p-4">
        <h2 className="mb-2 text-2xl leading-none">Con acceso</h2>
        <ul className="space-y-1">
          {(profiles.data ?? []).map((p) => (
            <li key={p.id} className="flex gap-2 border-b border-border/40 py-1">
              <span className="mr-auto font-bold">{p.display_name || p.email}</span>
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {roles.data?.some((r) => r.user_id === p.id && r.role === "admin")
                  ? "Admin"
                  : "Miembro"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
