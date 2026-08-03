import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth, useProfile, type ApprovalStatus } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Clock, LogOut, ShieldAlert, Save, KeyRound, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: {} });
    return { user: data.user };
  },
  component: AuthGate,
});

function AuthGate() {
  const profileQuery = useProfile();
  const profile = profileQuery.data;

  if (profileQuery.isLoading && !profile) return null;

  if (profile?.status === "pending" || profile?.status === "rejected") {
    return <PendingApprovalScreen status={profile.status} />;
  }

  if (profile?.status === "approved" && !profile.onboarded_at) {
    return <OnboardingForm />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const ONBOARDING_INSTRUMENTS = ["Percusión", "Trombón", "Trompeta", "Saxo", "Sousaphone"] as const;

function OnboardingForm() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.["display_name"] || user?.user_metadata?.["full_name"] || "",
  );
  const [instrument, setInstrument] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim(), instrument },
        password,
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim(), onboarded_at: new Date().toISOString() })
        .eq("id", user.id);
      if (profileError) throw profileError;

      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("¡Bienvenido a La Bomba Show!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido completar el alta");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <img src="/logo-titulo-2.png" alt="Logo de La Bomba Show" className="mb-2 h-32 w-auto" />

      <form onSubmit={submit} className="comic w-full max-w-sm rounded-xl bg-card p-5">
        <h1 className="mb-1 text-3xl">Crea tu usuario</h1>
        <p className="mb-4 text-sm font-bold text-muted-foreground">
          Tu cuenta ya está aprobada. Completa tus datos para entrar.
        </p>

        <label className="mb-3 block text-sm font-bold uppercase">
          Nombre
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-bold uppercase">Instrumento</label>
          <div className="comic-sm flex items-center rounded-md bg-background px-3 py-2">
            <span className="mr-2 text-2xl leading-none" role="img" aria-label="Instrumento">
              🎵
            </span>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              required
              className="w-full cursor-pointer bg-transparent text-base outline-none"
            >
              <option value="">Selecciona tu instrumento...</option>
              {ONBOARDING_INSTRUMENTS.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-3 block text-sm font-bold uppercase">
          Contraseña nueva
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <label className="mb-4 block text-sm font-bold uppercase">
          Repite la contraseña
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="comic comic-press flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-lg font-extrabold uppercase text-primary-foreground disabled:opacity-60"
        >
          {busy ? <KeyRound className="h-5 w-5" /> : <Save className="h-5 w-5" />}
          {busy ? "Guardando…" : "Crear usuario"}
        </button>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          {user?.email}
        </div>
      </form>
    </div>
  );
}

function PendingApprovalScreen({ status }: { status?: ApprovalStatus | undefined }) {
  const { user } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const rejected = status === "rejected";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <img src="/logo-titulo-2.png" alt="La Bomba Show" className="mb-4 h-28 w-auto" />
      <div className="comic flex w-full max-w-sm flex-col items-center gap-3 rounded-xl bg-card p-6 text-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            rejected ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"
          }`}
        >
          {rejected ? <ShieldAlert className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
        </div>
        <h1 className="text-2xl font-extrabold leading-none">
          {rejected ? "Acceso denegado" : "Cuenta pendiente de aprobación"}
        </h1>
        <p className="text-sm font-bold text-muted-foreground">
          {rejected
            ? "Un administrador ha rechazado tu acceso. Si crees que es un error, contacta con el administrador."
            : "Tu registro se ha enviado a los administradores. En cuanto aprueben tu cuenta podrás entrar a la app."}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="comic-sm comic-press flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-extrabold uppercase text-secondary-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
        {user && <p className="text-xs text-muted-foreground">{user.email}</p>}
      </div>
    </div>
  );
}
