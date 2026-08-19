import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  X,
  Clock,
  Lightbulb,
  UserCheck,
  UserPlus,
  Star,
  Gem,
  ShieldPlus,
  ShieldMinus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useRole, type AppRole } from "@/hooks/useAuth";
import { useRoleRequests, useSetlists, useInvalidate } from "@/lib/queries";
import {
  parseSetlistNotes,
  serializeSetlistNotes,
  type SetlistProposal,
} from "@/routes/_authenticated/setlists";

const ROLE_LABELS: Record<AppRole, string> = {
  miembro: "Miembro",
  admin: "Administrador",
  superadmin: "Superadministrador",
};

type UserWithStatus = {
  id: string;
  display_name: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
};

export function AdminManagement() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: role } = useRole();
  const isSuperAdmin = role === "superadmin";
  const requests = useRoleRequests();
  const setlists = useSetlists();
  const invalidate = useInvalidate();

  const [adminSubTab, setAdminSubTab] = useState<
    "usuarios" | "admin_requests" | "setlist_proposals"
  >("usuarios");

  const allProfilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name");
      if (error) throw error;
      return data;
    },
  });

  const allUsersQuery = useQuery({
    queryKey: ["all_users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at, status");
      if (error) throw error;
      return (data ?? []) as UserWithStatus[];
    },
  });

  const usersEmailQuery = useQuery({
    queryKey: ["all_users_emails", (allUsersQuery.data ?? []).map((u) => u.id).join(",")],
    enabled: isAdmin && !!allUsersQuery.data?.length,
    queryFn: async () => {
      const ids = allUsersQuery.data?.map((u) => u.id) ?? [];
      const result: Record<string, string | null> = {};
      for (const id of ids) {
        const { data } = await supabase.rpc("get_profile_email", { _user_id: id });
        result[id] = data ?? null;
      }
      return result;
    },
  });

  const allRolesQuery = useQuery({
    queryKey: ["all_user_roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: AppRole }[];
    },
  });

  const pendingAdminRequests = (requests.data ?? []).filter((r) => r.status === "pending");
  const pendingUsers = (allUsersQuery.data ?? []).filter((u) => u.status === "pending");

  const allPendingProposals: (SetlistProposal & { setlistId: string })[] = [];
  for (const sl of setlists.data ?? []) {
    const config = parseSetlistNotes(sl.notes);
    for (const prop of config.proposals ?? []) {
      if (prop.status === "pending") {
        allPendingProposals.push({ ...prop, setlistId: sl.id });
      }
    }
  }

  const totalPending =
    pendingAdminRequests.length + allPendingProposals.length + pendingUsers.length;

  function nameOf(userId: string) {
    const p = allProfilesQuery.data?.find((x) => x.id === userId);
    return p?.display_name || userId;
  }

  function roleOf(userId: string): AppRole {
    const rows = allRolesQuery.data ?? [];
    const userRoles = rows.filter((x) => x.user_id === userId).map((r) => r.role);
    if (userRoles.includes("superadmin")) return "superadmin";
    if (userRoles.includes("admin")) return "admin";
    return "miembro";
  }

  function emailOf(userId: string) {
    return usersEmailQuery.data?.[userId] ?? "";
  }

  async function decideRequest(requestId: string, userId: string, approve: boolean) {
    if (!user) return;

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
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      toast.error(error.message);
      return;
    }

    invalidate("role_requests", "user_roles", "profiles", "all_user_roles");
    toast.success(approve ? "Rol de administrador concedido" : "Solicitud rechazada");
  }

  async function setUserStatus(userId: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("profiles", "all_users", "profile-status");
    toast.success(status === "approved" ? "Acceso aprobado" : "Acceso rechazado");
  }

  async function setUserRole(userId: string, role: "admin" | "miembro") {
    if (role === "admin") {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error && !error.message.includes("duplicate")) {
        toast.error(error.message);
        return;
      }
      toast.success("Rol de administrador concedido");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Rol de administrador retirado");
    }
    invalidate("all_user_roles", "my-role", "user_roles");
  }

  async function decideProposal(
    proposal: SetlistProposal & { setlistId: string },
    approve: boolean,
  ) {
    const sl = (setlists.data ?? []).find((s) => s.id === proposal.setlistId);
    if (!sl) return;

    const config = parseSetlistNotes(sl.notes);
    const updatedProposals = (config.proposals ?? []).map((p) =>
      p.id === proposal.id
        ? { ...p, status: approve ? ("approved" as const) : ("rejected" as const) }
        : p,
    );

    if (approve) {
      if (proposal.kind === "bulk_edit" && proposal.bulk_items) {
        await supabase.from("setlist_items").delete().eq("setlist_id", sl.id);

        const fallbackPass = config.passes[0]?.id || "p1";
        const { data: inserted, error: insertError } = await supabase
          .from("setlist_items")
          .insert(
            proposal.bulk_items.map((bi) => ({
              setlist_id: sl.id,
              arrangement_id: bi.arrangement_id,
              position: bi.position,
              manual_title: bi.manual_title ?? null,
              manual_duration_seconds: bi.manual_duration_seconds ?? null,
            })),
          )
          .select("id");

        if (insertError) {
          toast.error(insertError.message);
          return;
        }

        const newPassMap: Record<string, string> = {};
        (inserted ?? []).forEach((row, i) => {
          const bi = proposal.bulk_items?.[i];
          if (bi) newPassMap[row.id] = bi.pass_id || fallbackPass;
        });

        const finalConfig = { ...config, proposals: updatedProposals, item_pass_map: newPassMap };
        const { error } = await supabase
          .from("setlists")
          .update({ notes: serializeSetlistNotes(finalConfig) })
          .eq("id", sl.id);
        if (error) {
          toast.error(error.message);
          return;
        }
      } else {
        const { data: newItem } = await supabase
          .from("setlist_items")
          .insert({
            setlist_id: sl.id,
            arrangement_id: proposal.arrangement_id,
            position: 9999,
          })
          .select("id")
          .single();

        if (newItem) {
          const newPassMap = { ...config.item_pass_map, [newItem.id]: proposal.pass_id };
          const finalConfig = { ...config, proposals: updatedProposals, item_pass_map: newPassMap };
          const { error } = await supabase
            .from("setlists")
            .update({ notes: serializeSetlistNotes(finalConfig) })
            .eq("id", sl.id);
          if (error) {
            toast.error(error.message);
            return;
          }
        }
      }
    } else {
      const finalConfig = { ...config, proposals: updatedProposals };
      const { error } = await supabase
        .from("setlists")
        .update({ notes: serializeSetlistNotes(finalConfig) })
        .eq("id", sl.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    invalidate("setlists", "setlist_items");
    toast.success(
      approve
        ? proposal.kind === "bulk_edit"
          ? `Cambios aplicados al setlist "${proposal.setlist_name}"`
          : `"${proposal.arrangement_title}" añadido al setlist "${proposal.setlist_name}"`
        : `Propuesta de "${proposal.arrangement_title}" rechazada`,
    );
  }

  // Agrupación de usuarios
  const allUsers = allUsersQuery.data ?? [];
  const admins = allUsers.filter((u) => roleOf(u.id) === "superadmin" || roleOf(u.id) === "admin");
  const members = allUsers.filter((u) => roleOf(u.id) === "miembro" && u.status === "approved");
  const pendingOrRejected = allUsers.filter((u) => u.status !== "approved");

  const renderUserCard = (u: UserWithStatus) => {
    const userRole = roleOf(u.id);
    const email = emailOf(u.id);
    return (
      <div
        key={u.id}
        className="comic-sm flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3"
      >
        <div className="min-w-0">
          <p className="font-extrabold text-base">
            {u.display_name || email || u.id}
            {u.id === user?.id && (
              <span className="ml-1 text-xs font-bold text-muted-foreground">(tú)</span>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          <p className="text-sm text-muted-foreground">
            Registrado el {new Date(u.created_at).toLocaleDateString("es-ES")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {u.status === "pending" && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-600 border border-amber-500/20">
                Pendiente de aprobación
              </span>
            )}
            {u.status === "rejected" && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-destructive border border-destructive/20">
                Rechazado
              </span>
            )}
            {u.status === "approved" && (
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                  userRole === "superadmin"
                    ? "bg-primary/15 text-primary"
                    : userRole === "admin"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {userRole === "superadmin" ? (
                  <Gem className="h-3 w-3" />
                ) : userRole === "admin" ? (
                  <Star className="h-3 w-3" />
                ) : null}
                {ROLE_LABELS[userRole]}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {u.id !== user?.id && isSuperAdmin && userRole !== "superadmin" && u.status === "approved" && (
            <button
              type="button"
              onClick={() => setUserRole(u.id, userRole === "admin" ? "miembro" : "admin")}
              className={`comic-sm comic-press flex items-center gap-1 rounded px-3 py-1.5 text-sm font-extrabold uppercase ${
                userRole === "admin"
                  ? "bg-muted text-muted-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
              title={userRole === "admin" ? "Retirar administrador" : "Hacer administrador"}
            >
              {userRole === "admin" ? (
                <ShieldMinus className="h-4 w-4" />
              ) : (
                <ShieldPlus className="h-4 w-4" />
              )}
              {userRole === "admin" ? "Quitar admin" : "Hacer admin"}
            </button>
          )}
          {u.status === "pending" && (
            <>
              <button
                type="button"
                onClick={() => setUserStatus(u.id, "approved")}
                className="comic-sm comic-press flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-extrabold uppercase text-primary-foreground"
              >
                <Check className="h-4 w-4" />
                Aprobar
              </button>
              <button
                type="button"
                onClick={() => setUserStatus(u.id, "rejected")}
                className="comic-sm comic-press flex items-center gap-1 rounded bg-destructive px-3 py-1.5 text-sm font-extrabold uppercase text-destructive-foreground"
              >
                <X className="h-4 w-4" />
                Rechazar
              </button>
            </>
          )}
          {u.status === "rejected" && (
            <button
              type="button"
              onClick={() => setUserStatus(u.id, "approved")}
              className="comic-sm comic-press flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-extrabold uppercase text-primary-foreground"
            >
              <Check className="h-4 w-4" />
              Aprobar
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="comic rounded-xl bg-card p-5 space-y-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-xl font-bold uppercase text-muted-foreground">
          Panel de administración
        </h2>
        {totalPending > 0 && (
          <span className="text-xs font-bold rounded-md bg-destructive/10 text-destructive px-2.5 py-1">
            {totalPending} pendiente{totalPending !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Sub-pestañas */}
      <div className="flex gap-1.5 overflow-x-auto rounded-lg bg-muted p-1.5">
        <button
          onClick={() => setAdminSubTab("usuarios")}
          className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-extrabold uppercase transition-colors ${
            adminSubTab === "usuarios"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Usuarios
          {pendingUsers.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-destructive px-1 text-[11px] font-extrabold leading-none text-destructive-foreground">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminSubTab("admin_requests")}
          className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-extrabold uppercase transition-colors ${
            adminSubTab === "admin_requests"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Peticiones de Admin
          {pendingAdminRequests.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-destructive px-1 text-[11px] font-extrabold leading-none text-destructive-foreground">
              {pendingAdminRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdminSubTab("setlist_proposals")}
          className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-extrabold uppercase transition-colors ${
            adminSubTab === "setlist_proposals"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lightbulb className="h-4 w-4" />
          Modificación Setlist
          {allPendingProposals.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-warning px-1 text-[11px] font-extrabold leading-none text-warning-foreground">
              {allPendingProposals.length}
            </span>
          )}
        </button>
      </div>

      {/* Sub-pestaña: Usuarios */}
      {adminSubTab === "usuarios" && (
        <div className="space-y-6">
          {!allUsersQuery.data || allUsersQuery.data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-10 w-10 mx-auto mb-2 text-primary/60" />
              <p className="font-bold">No hay usuarios registrados todavía.</p>
            </div>
          ) : (
            <>
              {pendingOrRejected.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold uppercase mb-2 text-amber-600 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> Pendientes / Rechazados
                  </h3>
                  <div className="space-y-2">{pendingOrRejected.map(renderUserCard)}</div>
                </div>
              )}

              {admins.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold uppercase mb-2 text-primary flex items-center gap-2">
                    <ShieldPlus className="h-4 w-4" /> Administradores
                  </h3>
                  <div className="space-y-2">{admins.map(renderUserCard)}</div>
                </div>
              )}

              {members.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold uppercase mb-2 text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> Miembros
                  </h3>
                  <div className="space-y-2">{members.map(renderUserCard)}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Sub-pestaña: Peticiones de Admin */}
      {adminSubTab === "admin_requests" && (
        <div className="space-y-3">
          {!isSuperAdmin && (
            <p className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm font-bold text-amber-600">
              Solo el superadministrador puede conceder o retirar el rol de administrador.
            </p>
          )}
          {pendingAdminRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-10 w-10 mx-auto mb-2 text-primary/60" />
              <p className="font-bold">No hay solicitudes de administrador pendientes.</p>
              <p className="text-sm mt-1">Todas las peticiones han sido atendidas.</p>
            </div>
          ) : (
            pendingAdminRequests.map((r) => (
              <div
                key={r.id}
                className="comic-sm flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3"
              >
                <div>
                  <p className="font-extrabold text-base">{nameOf(r.user_id)}</p>
                  <p className="text-sm text-muted-foreground">
                    Solicitado el {new Date(r.created_at).toLocaleDateString("es-ES")} a las{" "}
                    {new Date(r.created_at).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => decideRequest(r.id, r.user_id, true)}
                      className="comic-sm comic-press flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-extrabold uppercase text-primary-foreground"
                    >
                      <Check className="h-4 w-4" />
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => decideRequest(r.id, r.user_id, false)}
                      className="comic-sm comic-press flex items-center gap-1 rounded bg-destructive px-3 py-1.5 text-sm font-extrabold uppercase text-destructive-foreground"
                    >
                      <X className="h-4 w-4" />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Sub-pestaña: Modificación de Setlist (Propuestas) */}
      {adminSubTab === "setlist_proposals" && (
        <div className="space-y-3">
          {allPendingProposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-10 w-10 mx-auto mb-2 text-amber-400/60" />
              <p className="font-bold">No hay propuestas de canciones pendientes.</p>
              <p className="text-sm mt-1">Todas las sugerencias han sido atendidas.</p>
            </div>
          ) : (
            allPendingProposals.map((prop) => (
              <div
                key={prop.id}
                className="comic-sm flex flex-wrap items-start justify-between gap-3 rounded-lg bg-background p-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="truncate text-base font-extrabold leading-tight">
                      {prop.arrangement_title}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Para el setlist <span className="font-bold">{prop.setlist_name}</span>
                    {prop.kind !== "bulk_edit" && (
                      <>
                        {" · "} Pase: <span className="font-bold">{prop.pass_name}</span>
                      </>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Propuesto por <span className="font-bold">{prop.user_name}</span>
                    {" · "}
                    {new Date(prop.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decideProposal(prop, true)}
                    className="comic-sm comic-press flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-sm font-extrabold uppercase text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                    {prop.kind === "bulk_edit" ? "Aplicar" : "Añadir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decideProposal(prop, false)}
                    className="comic-sm comic-press flex items-center gap-1 rounded bg-destructive px-3 py-1.5 text-sm font-extrabold uppercase text-destructive-foreground"
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
