import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

/** Rol del usuario actual (superadmin > admin > miembro).
 *  Incluye suscripción Realtime para que el cambio de rol
 *  sea inmediato sin necesidad de recargar la página. */
export function useRole() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-role-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["my-role", user.id] });
          qc.invalidateQueries({ queryKey: ["all_user_roles"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

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
    retry: 2,
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

export type ProfileRow = {
  id: string;
  display_name: string | null;
  status: ApprovalStatus;
  onboarded_at: string | null;
};

/** Perfil completo del usuario actual (estado de aprobación + alta de usuario). */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    retry: 2,
    staleTime: 60_000,
    queryFn: async (): Promise<ProfileRow> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, status, onboarded_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        id: user!.id,
        display_name: data?.display_name ?? null,
        status: (data?.status as ApprovalStatus | undefined) ?? "pending",
        onboarded_at: data?.onboarded_at ?? null,
      };
    },
  });
}

export function useIsAdmin() {
  const roleQuery = useRole();
  const isAdmin = roleQuery.data === "admin" || roleQuery.data === "superadmin";
  return { isAdmin, isLoading: roleQuery.isLoading };
}
