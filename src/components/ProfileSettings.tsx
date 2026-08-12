import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Shield, Clock, KeyRound, Mail, Save, Star, Gem } from "lucide-react";
import { SousaphoneIcon } from "@/components/InstrumentIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRole, type AppRole } from "@/hooks/useAuth";
import { useRoleRequests, useInvalidate } from "@/lib/queries";

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

export function ProfileSettings() {
  const { user } = useAuth();
  const { data: role } = useRole();
  const requests = useRoleRequests();
  const invalidate = useInvalidate();

  const [displayName, setDisplayName] = useState("");
  const [instrument, setInstrument] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

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

  const myRequest = (requests.data ?? []).find((r) => r.user_id === user?.id);

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

  return (
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
                  <span className="mr-2 text-2xl leading-none" role="img" aria-label={instrument}>
                    {emoji}
                  </span>
                );
              }
              const GeneratedIcon = INSTRUMENT_GENERATED_ICONS[instrument];
              if (GeneratedIcon) {
                return <GeneratedIcon className="mr-2 h-6 w-6 text-primary" />;
              }
              return (
                <span className="mr-2 text-2xl leading-none" role="img" aria-label="Instrumento">
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
        <div className="border-t-2 border-dashed border-border pt-4">
          <h2 className="text-xl font-bold uppercase text-muted-foreground">Cambiar contraseña</h2>

          <div className="mt-3 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-bold uppercase">Contraseña actual</label>
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
  );
}
