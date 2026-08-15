import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "La Bomba Show — App de la xaranga" },
      {
        name: "description",
        content: "Acceso a letras, repertorio, setlists y contadores de La Bomba Show.",
      },
      { property: "og:title", content: "La Bomba Show — App de la xaranga" },
      {
        property: "og:description",
        content: "Acceso a letras, repertorio, setlists y contadores de La Bomba Show.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error_description") ?? params.get("error");
    if (user) {
      navigate({ to: "/inicio", replace: true });
      return;
    }
    navigate({ to: "/auth", replace: true, search: error ? { error } : {} });
  }, [loading, navigate, user]);

  return <AppLoadingScreen />;
}

function AppLoadingScreen() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <img src="/logo-titulo-2.png" alt="La Bomba Show" className="h-28 w-auto" />
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="text-sm font-semibold text-muted-foreground">Cargando la app…</p>
    </main>
  );
}
