import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/inicio" });

    const url = new URL(window.location.href);
    const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    if (oauthError) {
      throw redirect({ to: "/auth", search: { error: oauthError } });
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
