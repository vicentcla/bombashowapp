import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
const BANNER_SRC = "/banner-2.png";
const LOGO_SRC = "/logo-titulo-2.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogIn, KeyRound, Mail, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) =>
    ({
      error: typeof search["error"] === "string" ? search["error"] : undefined,
    }) as { error?: string },
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
  const { error: oauthError } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (oauthError) {
      toast.error(`No se pudo iniciar sesión con Google: ${oauthError}`);
      navigate({ to: "/auth", replace: true, search: {} });
    }
  }, [oauthError, navigate]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const isRecovery =
      url.searchParams.get("type") === "recovery" || url.hash.includes("type=recovery");

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    if (isRecovery) setRecovery(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !isRecovery) {
        navigate({ to: "/inicio", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (recovery) return <RecoveryForm />;
  if (forgotSent) return <RecoverySent email={email} onBack={() => setForgotSent(false)} />;

  async function sendRecoveryEmail() {
    const target = email.trim();
    if (!target) {
      toast.error("Escribe tu correo para enviarte el enlace de recuperación");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido enviar el correo");
    } finally {
      setBusy(false);
    }
  }

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
      const host = window.location.hostname;
      const isLovableHost =
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com") ||
        host === "localhost";

      if (!isLovableHost) {
        // Fuera de Lovable (Cloudflare): OAuth directo de Supabase en ventana
        // emergente para no sacar la app (PWA) y obligar a elegir cuenta.
        const redirectTo = `${window.location.origin}/oauth-callback.html`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("No se pudo iniciar sesión con Google");
        const ok = await openGooglePopup(data.url);
        if (ok) navigate({ to: "/inicio", replace: true });
        return;
      }

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/inicio", replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se ha podido iniciar sesión con Google";
      toast.error(
        message.toLowerCase().includes("redirect") || message.toLowerCase().includes("url")
          ? `${message} — Añade la URL de esta página a Redirect URLs en Supabase (Authentication → URL Configuration) y configura el proveedor Google.`
          : message,
      );
    } finally {
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
          type="button"
          onClick={sendRecoveryEmail}
          disabled={busy}
          className="mb-4 flex items-center gap-1.5 text-sm font-bold text-primary hover:underline disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          He olvidado la contraseña
        </button>

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

const OAUTH_POPUP_TIMEOUT_MS = 120000;

function openGooglePopup(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const width = 520;
    const height = 600;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    const popup = window.open(
      url,
      "bombashow_google",
      `width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!popup) {
      toast.error("El navegador bloqueó la ventana de acceso. Permite ventanas emergentes.");
      resolve(false);
      return;
    }

    let done = false;

    const cleanup = () => {
      clearInterval(interval);
      window.removeEventListener("message", onMessage);
      try {
        popup.close();
      } catch {
        /* noop */
      }
    };

    const applyTokens = async (params: URLSearchParams) => {
      const error = params.get("error_description") ?? params.get("error");
      if (error) {
        cleanup();
        toast.error(`No se pudo iniciar sesión con Google: ${error}`);
        resolve(false);
        return;
      }
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const code = params.get("code");
      if (!((accessToken && refreshToken) || code)) return;
      done = true;
      cleanup();
      try {
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        resolve(true);
      } catch {
        toast.error("No se pudo completar el acceso con Google");
        resolve(false);
      }
    };

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || done) return;
      const data = e.data as { type?: string; hash?: string };
      if (!data || data.type !== "oauth_callback") return;
      applyTokens(new URLSearchParams((data.hash ?? "").replace(/^#/, "")));
    }

    const interval = setInterval(() => {
      if (done) return;
      if (popup.closed) {
        cleanup();
        resolve(false);
        return;
      }
      let href = "";
      try {
        href = popup.location.href;
      } catch {
        return;
      }
      if (href.startsWith(window.location.origin)) {
        applyTokens(new URLSearchParams((popup.location.hash ?? "").replace(/^#/, "")));
      }
    }, 300);

    window.addEventListener("message", onMessage);
    setTimeout(() => {
      if (done) return;
      cleanup();
      toast.error("Se agotó el tiempo. Vuelve a intentarlo.");
      resolve(false);
    }, OAUTH_POPUP_TIMEOUT_MS);
  });
}

function RecoverySent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <img src={LOGO_SRC} alt="Logo de La Bomba Show" className="mb-2 h-32 w-auto" />
      <img src={BANNER_SRC} alt="La Bomba Show Xaranga" className="mb-6 w-full max-w-sm" />

      <div className="comic w-full max-w-sm rounded-xl bg-card p-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-7 w-7" />
        </div>
        <h1 className="mb-2 text-2xl">Revisa tu correo</h1>
        <p className="text-sm font-bold text-muted-foreground">
          Hemos enviado un enlace a <span className="text-foreground">{email}</span> para
          restablecer tu contraseña. Si no lo ves, revisa la carpeta de spam.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="comic-sm comic-press mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-4 py-3 text-base font-extrabold uppercase text-secondary-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          Volver
        </button>
      </div>
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
