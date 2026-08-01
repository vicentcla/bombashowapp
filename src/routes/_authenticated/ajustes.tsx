import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Shield, Music, Check, X, Clock, Settings, Mail, Save } from "lucide-react";
import {
  PercusionIcon,
  TrombonIcon,
  TrompetaIcon,
  SaxoIcon,
  SousaphoneIcon,
} from "@/components/InstrumentIcons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useRoleRequests, useInvalidate } from "@/lib/queries";

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
  "Percusión": PercusionIcon,
  "Trombón": TrombonIcon,
  "Trompeta": TrompetaIcon,
  "Saxo": SaxoIcon,
  "Sousaphone": SousaphoneIcon,
};

function Ajustes() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const requests = useRoleRequests();
  const invalidate = useInvalidate();

  const [activeTab, setActiveTab] = useState<"perfil" | "solicitudes">("perfil");

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
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Lista de perfiles para resolver nombres de solicitantes
  const allProfilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email");
      if (error) throw error;
      return data;
    },
  });

  // Cargar datos iniciales del usuario
  useEffect(() => {
    if (user) {
      const metaName = user.user_metadata?.display_name || user.user_metadata?.full_name || "";
      const metaInstrument = user.user_metadata?.instrument || "";
      
      const dbName = profileQuery.data?.display_name || "";
      const dbInstrument = (profileQuery.data as Record<string, unknown> | null)?.instrument as string || "";

      setDisplayName(dbName || metaName || user.email?.split("@")[0] || "");
      setInstrument(dbInstrument || metaInstrument || "");
    }
  }, [user, profileQuery.data]);

  const pendingRequests = (requests.data ?? []).filter((r) => r.status === "pending");
  const myRequest = (requests.data ?? []).find((r) => r.user_id === user?.id);

  function nameOf(userId: string) {
    const p = allProfilesQuery.data?.find((x) => x.id === userId);
    return p?.display_name || p?.email || userId;
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      // 1. Actualizar metadata de auth
      await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          instrument,
        },
      });

      // 2. Intentar actualizar tabla profiles
      const profileData: Record<string, unknown> = {
        id: user.id,
        email: user.email,
        display_name: displayName.trim(),
      };
      
      // Añadimos instrumento si existe en la columna
      try {
        profileData.instrument = instrument;
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
            {pendingRequests.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                ({pendingRequests.length})
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
              <label className="mb-1 block text-sm font-bold uppercase">
                Nombre de usuario
              </label>
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
              <label className="mb-1 block text-sm font-bold uppercase">
                Correo electrónico
              </label>
              <div className="comic-sm flex items-center rounded-md bg-muted px-3 py-2 text-muted-foreground">
                <Mail className="mr-2 h-4 w-4" />
                <span className="font-semibold text-base">{user?.email}</span>
              </div>
            </div>

            {/* Rol Actual */}
            <div>
              <label className="mb-1 block text-sm font-bold uppercase">
                Rol actual
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-3">
                <div className="flex items-center gap-2">
                  <Shield
                    className={`h-5 w-5 ${
                      isAdmin ? "text-primary" : "text-muted-foreground"
                    }`}
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
              <label className="mb-1 block text-sm font-bold uppercase">
                Instrumento
              </label>
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
              Solicitudes de Administrador
            </h2>
            <span className="text-xs font-bold rounded-md bg-secondary px-2.5 py-1">
              Total pendientes: {pendingRequests.length}
            </span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-10 w-10 mx-auto mb-2 text-primary/60" />
              <p className="font-bold">No hay solicitudes pendientes en este momento.</p>
              <p className="text-xs mt-1">
                Todas las peticiones de rol han sido atendidas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((r) => (
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
