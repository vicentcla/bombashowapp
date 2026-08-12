import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User,
  Shield,
  Check,
  X,
  Clock,
  KeyRound,
  Settings,
  Mail,
  Save,
  Lightbulb,
  UserCheck,
  UserPlus,
  Gem,
  Star,
  UserX,
  ShieldPlus,
  ShieldMinus,
} from "lucide-react";
import { SousaphoneIcon } from "@/components/InstrumentIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin, useRole, type AppRole } from "@/hooks/useAuth";
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

const INSTRUMENT_EMOJIS: Record<string, string> = {
  Percusión: "🥁",
  Trombón: "🪊",
  Trompeta: "🎺",
  Saxo: "🎷",
};

const INSTRUMENT_GENERATED_ICONS: Record<string, React.ElementType> = {
  Sousaphone: SousaphoneIcon,
};

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

function Ajustes() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: role } = useRole();
  const isSuperAdmin = role === "superadmin";
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

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

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
        .select("id, display_name, created_at, status");
      if (error) throw error;
      return (data ?? []) as UserWithStatus[];
    },
  });

  // Correos de los usuarios (solo admins; el email no es seleccionable por columna)
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

  // Roles de todos los usuarios
  const allRolesQuery = useQuery({
    queryKey: ["all_user_roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: AppRole }[];
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
  const pendingUsers = (allUsersQuery.data ?? []).filter((u) => u.status === "pending");

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

  const totalPending =
    pendingAdminRequests.length + allPendingProposals.length + pendingUsers.length;

  function nameOf(userId: string) {
    const p = allProfilesQuery.data?.find((x) => x.id === userId);
    return p?.display_name || userId;
  }

  function roleOf(userId: string): AppRole {
    const rows = allRolesQuery.data ?? [];
    const r = rows.find((x) => x.user_id === userId)?.role;
    return r ?? "miembro";
  }

  function emailOf(userId: string) {
    return usersEmailQuery.data?.[userId] ?? "";
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

  async function handleChangePassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user?.email) return;
    if (!oldPassword) {
      toast.error("Escribe tu contraseña actual");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }

    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) {
        toast.error("La contraseña actual no es correcta");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Contraseña cambiada correctamente");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido cambiar la contraseña");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleForgotPassword() {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Te hemos enviado un correo para restablecer la contraseña");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido enviar el correo");
    } finally {
      setSendingReset(false);
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
    toast.success("Solicitud enviada al superadministrador");
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
        <Settings className="h-7 w-7 shrink-0 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-extrabold leading-none">Ajustes de usuario</h1>
          <p className="text-xs font-bold text-muted-foreground">
            Gestiona tu información personal e instrumento
          </p>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="comic-sm flex border-b border-border bg-card">
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
            Gestión
            {totalPending > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-destructive px-1 text-[11px] font-extrabold leading-none text-destructive-foreground">
                {totalPending > 99 ? "99+" : totalPending}
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
                  {role === "superadmin" ? (
                    <Gem className="h-5 w-5 text-primary" />
                  ) : role === "admin" ? (
                    <Star className="h-5 w-5 text-primary" />
                  ) : (
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="font-extrabold">{ROLE_LABELS[role ?? "miembro"]}</span>
                </div>

                {role === "miembro" && (
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
                  const emoji = INSTRUMENT_EMOJIS[instrument];
                  if (emoji) {
                    return (
                      <span
                        className="mr-2 text-2xl leading-none"
                        role="img"
                        aria-label={instrument}
                      >
                        {emoji}
                      </span>
                    );
                  }
                  const GeneratedIcon = INSTRUMENT_GENERATED_ICONS[instrument];
                  if (GeneratedIcon) {
                    return <GeneratedIcon className="mr-2 h-6 w-6 text-primary" />;
                  }
                  return (
                    <span
                      className="mr-2 text-2xl leading-none"
                      role="img"
                      aria-label="Instrumento"
                    >
                      🎵
                    </span>
                  );
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

            {/* Cambio de contraseña */}
            <div className="border-t-2 border-dashed border-ink/20 pt-4">
              <h2 className="text-xl font-bold uppercase text-muted-foreground">
                Cambiar contraseña
              </h2>

              <div className="mt-3 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold uppercase">
                    Contraseña actual
                  </label>
                  <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
                    <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Tu contraseña actual"
                      className="w-full bg-transparent text-base outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold uppercase">Nueva contraseña</label>
                  <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
                    <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-transparent text-base outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold uppercase">
                    Repite la nueva contraseña
                  </label>
                  <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
                    <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Repite la contraseña"
                      className="w-full bg-transparent text-base outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleChangePassword()}
                  disabled={changingPassword}
                  className="comic comic-press flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-3 font-extrabold uppercase text-secondary-foreground disabled:opacity-50"
                >
                  <KeyRound className="h-5 w-5" />
                  {changingPassword ? "Cambiando..." : "Cambiar contraseña"}
                </button>
              </div>

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={sendingReset}
                  className="text-sm font-bold text-primary underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                >
                  {sendingReset ? "Enviando correo…" : "He olvidado la contraseña"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Contenido de Pestaña: Gestión (Solo Admin) */}
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
            <div className="space-y-3">
              {!allUsersQuery.data || allUsersQuery.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="h-10 w-10 mx-auto mb-2 text-primary/60" />
                  <p className="font-bold">No hay usuarios registrados todavía.</p>
                </div>
              ) : (
                allUsersQuery.data.map((u) => {
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
                            <span className="ml-1 text-xs font-bold text-muted-foreground">
                              (tú)
                            </span>
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
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {u.id !== user?.id && isSuperAdmin && userRole !== "superadmin" && (
                          <button
                            type="button"
                            onClick={() =>
                              setUserRole(u.id, userRole === "admin" ? "miembro" : "admin")
                            }
                            className="comic-sm comic-press flex items-center gap-1 rounded bg-secondary px-3 py-1.5 text-sm font-extrabold uppercase text-secondary-foreground"
                            title={
                              userRole === "admin" ? "Retirar administrador" : "Hacer administrador"
                            }
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
                })
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
      )}
    </div>
  );
}
