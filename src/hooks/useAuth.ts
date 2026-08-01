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

export type AppRole = "miembro" | "admin" | "superadmin";
export type ApprovalStatus = "pending" | "approved" | "rejected";

/** Rol del usuario actual (superadmin > admin > miembro). */
export function useRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-role", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role);
      if (roles.includes("superadmin")) return "superadmin";
      if (roles.includes("admin")) return "admin";
      return "miembro";
    },
  });
}

/** Estado de aprobación de la cuenta del usuario actual. */
export function useProfileStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile-status", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ApprovalStatus> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.status as ApprovalStatus | undefined) ?? "pending";
    },
  });
}

export function useIsAdmin() {
  const roleQuery = useRole();
  const isAdmin = roleQuery.data === "admin" || roleQuery.data === "superadmin";
  return { isAdmin, isLoading: roleQuery.isLoading };
}
