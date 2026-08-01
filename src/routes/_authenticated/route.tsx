import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth, useProfileStatus, type ApprovalStatus } from "@/hooks/useAuth";
import { Clock, LogOut, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthGate,
});

function AuthGate() {
  const { data: status } = useProfileStatus();

  if (status === "pending" || status === "rejected") {
    return <PendingApprovalScreen status={status} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
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
