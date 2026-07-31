import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import bannerAsset from "@/assets/banner.png.asset.json";
import logoAsset from "@/assets/logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/inicio", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/inicio", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/inicio", replace: true });
        } else {
          toast.success("Revisa tu correo para confirmar la cuenta.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido completar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <img src={logoAsset.url} alt="Logo de La Bomba Show" className="mb-2 h-32 w-auto" />
      <img src={bannerAsset.url} alt="La Bomba Show Xaranga" className="mb-6 w-full max-w-sm" />

      <form onSubmit={submit} className="comic w-full max-w-sm rounded-xl bg-card p-5">
        <h1 className="mb-4 text-3xl">{mode === "login" ? "Entrar" : "Crear cuenta"}</h1>

        {mode === "signup" && (
          <label className="mb-3 block text-sm font-bold uppercase">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
            />
          </label>
        )}

        <label className="mb-3 block text-sm font-bold uppercase">
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
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
            className="comic-sm mt-1 w-full rounded-md bg-background px-3 py-2 text-base font-normal outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="comic comic-press w-full rounded-md bg-primary px-4 py-3 text-lg font-extrabold uppercase text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm font-bold text-muted-foreground underline"
        >
          {mode === "login" ? "No tengo cuenta todavía" : "Ya tengo cuenta"}
        </button>
      </form>
    </div>
  );
}
