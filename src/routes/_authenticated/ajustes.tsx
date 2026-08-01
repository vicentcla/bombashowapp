import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User,
  Shield,
  Music,
  Check,
  X,
  Clock,
  Settings,
  Mail,
  Save,
  Lightbulb,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  PercusionIcon,
  TrombonIcon,
  TrompetaIcon,
  SaxoIcon,
  SousaphoneIcon,
} from "@/components/InstrumentIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useRoleRequests, useSetlists, useInvalidate } from "@/lib/queries";
import {
  parseSetlistNotes,
  serializeSetlistNotes,
  type SetlistProposal,
} from "@/routes/_authenticated/setlists";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — La Bomba Show" },
      { name: "description", content: "Ajustes de perfil y gestión de cuenta." },
    ],
  }),
  component: Ajustes,
});

const INSTRUMENTS = ["Percusión", "Trombón", "Trompeta", "Saxo", "Sousaphone"] as const;
type Instrument = (typeof INSTRUMENTS)[number];

const INSTRUMENT_ICONS: Record<string, React.ElementType> = {
  Percusión: PercusionIcon,
  Trombón: TrombonIcon,
  Trompeta: TrompetaIcon,
  Saxo: SaxoIcon,
  Sousaphone: SousaphoneIcon,
};

function Ajustes() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const requests = useRoleRequests();
  const setlists = useSetlists();
  const invalidate = useInvalidate();

  const [activeTab, setActiveTab] = useState<"perfil" | "solicitudes">("perfil");
  const [adminSubTab, setAdminSubTab] = useState<
    "usuarios" | "admin_requests" | "setlist_proposals"
  >("usuarios");

  // Perfil state
  const [displayName, setDisplayName] = useState("");
  const [instrument, setInstrument] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Obtener perfil de la BD
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Lista de perfiles para resolver nombres
  const allProfilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name");
      if (error) throw error;
      return data;
    },
  });

  // Lista de todos los usuarios registrados (para pestaña "Usuarios nuevos")
  const allUsersQuery = useQuery({
    queryKey: ["all_users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Cargar datos iniciales del usuario
  useEffect(() => {
    if (user) {
      const metaName =
        user.user_metadata?.["display_name"] || user.user_metadata?.["full_name"] || "";
      const metaInstrument = user.user_metadata?.["instrument"] || "";

      const dbName = profileQuery.data?.["display_name"] || "";
      const dbInstrument =
        ((profileQuery.data as Record<string, unknown> | null)?.["instrument"] as string) || "";

      setDisplayName(dbName || metaName || user.email?.split("@")[0] || "");
      setInstrument(dbInstrument || metaInstrument || "");
    }
  }, [user, profileQuery.data]);

  const pendingAdminRequests = (requests.data ?? []).filter((r) => r.status === "pending");
  const myRequest = (requests.data ?? []).find((r) => r.user_id === user?.id);

  // Recopilar todas las propuestas pendientes de todos los setlists
  const allPendingProposals: (SetlistProposal & { setlistId: string })[] = [];
  for (const sl of setlists.data ?? []) {
    const config = parseSetlistNotes(sl.notes);
    for (const prop of config.proposals ?? []) {
      if (prop.status === "pending") {
        allPendingProposals.push({ ...prop, setlistId: sl.id });
      }
    }
  }

  const totalPending = pendingAdminRequests.length + allPendingProposals.length;

  function nameOf(userId: string) {
    const p = allProfilesQuery.data?.find((x) => x.id === userId);
    return p?.display_name || userId;
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          instrument,
        },
      });

      const profileData: Record<string, unknown> = {
        id: user.id,
        email: user.email,
        display_name: displayName.trim(),
      };

      try {
        profileData["instrument"] = instrument;
      } catch {
        // Ignorar si no aplica
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profileData as { id: string; email?: string | null; display_name?: string | null });

      if (profileError) {
        console.warn("Advertencia al actualizar profiles:", profileError.message);
      }

      invalidate("profile", "profiles");
      toast.success("Perfil actualizado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function requestAdmin() {
    if (!user) return;
    const { error } = await supabase.from("role_requests").insert({ user_id: user.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate("role_requests");
    toast.success("Solicitud enviada a los administradores");
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

    invalidate("role_requests", "user_roles", "profiles");
    toast.success(approve ? "Rol de administrador concedido" : "Solicitud rechazada");
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
        // Propuesta completa: reemplaza los temas del setlist por los de la propuesta
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
        // Propuesta simple: añadir una canción al setlist
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="comic-sm rounded-lg bg-primary p-2.5 text-primary-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold leading-none">Ajustes de usuario</h1>
          <p className="text-xs font-bold text-muted-foreground">
            Gestiona tu información personal e instrumento
          </p>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="comic-sm flex border-b-2 border-ink bg-card">
        <button
          onClick={() => setActiveTab("perfil")}
          className={`flex items-center gap-2 border-b-4 px-4 py-3 text-sm font-extrabold uppercase transition-all ${
            activeTab === "perfil"
              ? "border-primary bg-background text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          Perfil
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("solicitudes")}
            className={`flex items-center gap-2 border-b-4 px-4 py-3 text-sm font-extrabold uppercase transition-all ${
              activeTab === "solicitudes"
                ? "border-primary bg-background text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" />
            Solicitudes pendientes
            {totalPending > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                {totalPending}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Contenido de Pestaña: Perfil */}
      {activeTab === "perfil" && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="comic rounded-xl bg-card p-5 space-y-4">
            <h2 className="text-xl font-bold uppercase text-muted-foreground border-b pb-2">
              Información de la Cuenta
            </h2>

            {/* Nombre de Usuario */}
            <div>
              <label className="mb-1 block text-sm font-bold uppercase">Nombre de usuario</label>
              <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre o apodo"
                  className="w-full bg-transparent text-base outline-none"
                  required
                />
              </div>
            </div>

            {/* Correo Electrónico (Solo Lectura) */}
            <div>
              <label className="mb-1 block text-sm font-bold uppercase">Correo electrónico</label>
              <div className="comic-sm flex items-center rounded-md bg-muted px-3 py-2 text-muted-foreground">
                <Mail className="mr-2 h-4 w-4" />
                <span className="font-semibold text-base">{user?.email}</span>
              </div>
            </div>

            {/* Rol Actual */}
            <div>
              <label className="mb-1 block text-sm font-bold uppercase">Rol actual</label>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-3">
                <div className="flex items-center gap-2">
                  <Shield
                    className={`h-5 w-5 ${isAdmin ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="font-extrabold">
                    {isAdmin ? "Administrador" : "Usuario básico"}
                  </span>
                </div>

                {!isAdmin && (
                  <div>
                    {myRequest?.status === "pending" ? (
                      <span className="flex items-center gap-1 text-xs font-extrabold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5" /> Solicitud pendiente
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={requestAdmin}
                        className="comic-sm comic-press rounded bg-accent px-3 py-1 text-xs font-extrabold uppercase text-accent-foreground"
                      >
                        Pedir ser administrador
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selección de Instrumento */}
            <div>
              <label className="mb-1 block text-sm font-bold uppercase">Instrumento</label>
              <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
                {(() => {
                  const InstrIcon = INSTRUMENT_ICONS[instrument] ?? Music;
                  return <InstrIcon className="mr-2 h-4 w-4 text-primary transition-all" />;
                })()}
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  className="w-full bg-transparent text-base outline-none cursor-pointer"
                >
                  <option value="">Selecciona tu instrumento...</option>
                  {INSTRUMENTS.map((inst) => (
                    <option key={inst} value={inst}>
                      {inst}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Elige tu instrumento principal en la charanga.
              </p>
            </div>

            {/* Botón Guardar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="comic comic-press flex items-center justify-center gap-2 w-full rounded-lg bg-primary py-3 font-extrabold uppercase text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-5 w-5" />
                {saving ? "Guardando..." : "Guardar cambios de perfil"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Contenido de Pestaña: Solicitudes Pendientes (Solo Admin) */}
      {activeTab === "solicitudes" && isAdmin && (
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
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setAdminSubTab("usuarios")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-extrabold uppercase transition-colors ${
                adminSubTab === "usuarios"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Usuarios nuevos
            </button>
            <button
              onClick={() => setAdminSubTab("admin_requests")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-extrabold uppercase transition-colors ${
                adminSubTab === "admin_requests"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Peticiones de Admin
              {pendingAdminRequests.length > 0 && (
                <span className="rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[10px] font-bold">
                  {pendingAdminRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminSubTab("setlist_proposals")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-extrabold uppercase transition-colors ${
                adminSubTab === "setlist_proposals"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Modificación Setlist
              {allPendingProposals.length > 0 && (
                <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[10px] font-bold">
                  {allPendingProposals.length}
                </span>
              )}
            </button>
          </div>

          {/* Sub-pestaña: Usuarios nuevos */}
          {adminSubTab === "usuarios" && (
            <div className="space-y-3">
              {!allUsersQuery.data || allUsersQuery.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-10 w-10 mx-auto mb-2 text-primary/60" />
                  <p className="font-bold">No hay usuarios registrados todavía.</p>
                </div>
              ) : (
                allUsersQuery.data.map((u) => (
                  <div
                    key={u.id}
                    className="comic-sm flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3 border"
                  >
                    <div>
                      <p className="font-extrabold text-base">
                        {u.display_name || u.email || u.id}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Registrado el {new Date(u.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                    <span className="text-xs font-bold bg-secondary rounded-md px-2.5 py-1">
                      Miembro
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-pestaña: Peticiones de Admin */}
          {adminSubTab === "admin_requests" && (
            <div className="space-y-3">
              {pendingAdminRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-10 w-10 mx-auto mb-2 text-primary/60" />
                  <p className="font-bold">No hay solicitudes de administrador pendientes.</p>
                  <p className="text-xs mt-1">Todas las peticiones han sido atendidas.</p>
                </div>
              ) : (
                pendingAdminRequests.map((r) => (
                  <div
                    key={r.id}
                    className="comic-sm flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3 border"
                  >
                    <div>
                      <p className="font-extrabold text-base">{nameOf(r.user_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado el {new Date(r.created_at).toLocaleDateString("es-ES")} a las{" "}
                        {new Date(r.created_at).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decideRequest(r.id, r.user_id, true)}
                        className="comic-sm comic-press flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => decideRequest(r.id, r.user_id, false)}
                        className="comic-sm comic-press flex items-center gap-1 rounded bg-destructive px-3 py-1.5 text-xs font-extrabold uppercase text-destructive-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Rechazar
                      </button>
                    </div>
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
                  <p className="text-xs mt-1">Todas las sugerencias han sido atendidas.</p>
                </div>
              ) : (
                allPendingProposals.map((prop) => (
                  <div
                    key={prop.id}
                    className="comic-sm flex flex-wrap items-start justify-between gap-3 rounded-lg bg-background p-3 border border-amber-500/20"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <p className="font-extrabold text-base leading-tight truncate">
                          {prop.arrangement_title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Para el setlist <span className="font-bold">{prop.setlist_name}</span>
                        {prop.kind !== "bulk_edit" && (
                          <>
                            {" · "} Pase: <span className="font-bold">{prop.pass_name}</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Propuesto por <span className="font-bold">{prop.user_name}</span>
                        {" · "}
                        {new Date(prop.created_at).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decideProposal(prop, true)}
                        className="comic-sm comic-press flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-extrabold uppercase text-primary-foreground"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {prop.kind === "bulk_edit" ? "Aplicar" : "Añadir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => decideProposal(prop, false)}
                        className="comic-sm comic-press flex items-center gap-1 rounded bg-destructive px-3 py-1.5 text-xs font-extrabold uppercase text-destructive-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
