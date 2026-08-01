import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
const BANNER_SRC = "/banner-2.png";
const LOGO_SRC = "/logo-titulo-2.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogIn, KeyRound } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — La Bomba Show" },
      {
        name: "description",
        content: "Acceso privado para los miembros de La Bomba Show Xaranga.",
      },
      { property: "og:title", content: "Entrar — La Bomba Show" },
      {
        property: "og:description",
        content: "Acceso privado para los miembros de La Bomba Show Xaranga.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !window.location.hash.includes("type=recovery")) {
        navigate({ to: "/inicio", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (recovery) return <RecoveryForm />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido iniciar sesión");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido iniciar sesión con Google");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <img src={LOGO_SRC} alt="Logo de La Bomba Show" className="mb-2 h-32 w-auto" />
      <img src={BANNER_SRC} alt="La Bomba Show Xaranga" className="mb-6 w-full max-w-sm" />

      <form onSubmit={submit} className="comic w-full max-w-sm rounded-xl bg-card p-5">
        <h1 className="mb-4 text-3xl">Entrar</h1>

        <label className="mb-3 block text-sm font-bold uppercase">
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="email"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <label className="mb-4 block text-sm font-bold uppercase">
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="comic comic-press flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-lg font-extrabold uppercase text-primary-foreground disabled:opacity-60"
        >
          <LogIn className="h-5 w-5" />
          {busy ? "Un momento…" : "Entrar"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          o
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="comic-sm comic-press flex w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-background px-4 py-3 text-base font-extrabold uppercase text-foreground hover:bg-muted disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.46a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.09-1.93 3.67-4.76 3.67-8.33z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.57-2.77c-1 .66-2.26 1.06-4.36 1.06-3.35 0-6.18-2.26-7.2-5.3H1.1v2.85A12 12 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M4.8 14.08a7.2 7.2 0 0 1 0-4.16V7.07H1.1a12 12 0 0 0 0 9.86l3.7-2.85z"
            />
            <path
              fill="#EA4335"
              d="M12 4.62c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 1.1 7.07l3.7 2.85C5.82 6.88 8.65 4.62 12 4.62z"
            />
          </svg>
          Continuar con Gmail
        </button>

        <p className="mt-4 text-center text-xs font-bold text-muted-foreground">
          Los nuevos accesos se registran con Gmail y quedan{" "}
          <span className="text-foreground">pendientes de aprobación</span> de un administrador.
        </p>
      </form>
    </div>
  );
}

function RecoveryForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña restablecida correctamente");
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido restablecer la contraseña");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <img src={LOGO_SRC} alt="Logo de La Bomba Show" className="mb-2 h-32 w-auto" />
      <img src={BANNER_SRC} alt="La Bomba Show Xaranga" className="mb-6 w-full max-w-sm" />

      <form onSubmit={submit} className="comic w-full max-w-sm rounded-xl bg-card p-5">
        <h1 className="mb-4 text-3xl">Nueva contraseña</h1>

        <label className="mb-3 block text-sm font-bold uppercase">
          Nueva contraseña
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
          <KeyRound className="h-5 w-5" />
          {busy ? "Guardando…" : "Restablecer contraseña"}
        </button>
      </form>
    </div>
  );
}
