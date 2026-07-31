import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useIsAdmin() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return { isAdmin: !!data, isLoading };
}
