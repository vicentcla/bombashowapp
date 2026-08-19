import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGlobalRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Escuchar todos los eventos INSERT, UPDATE, DELETE en el esquema public
    const channel = supabase
      .channel("global-db-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const table = payload.table;

        switch (table) {
          case "arrangements":
            queryClient.invalidateQueries({ queryKey: ["arrangements"] });
            break;
          case "street_songs":
            queryClient.invalidateQueries({ queryKey: ["street_songs"] });
            break;
          case "lyrics":
            queryClient.invalidateQueries({ queryKey: ["lyrics"] });
            break;
          case "setlists":
            queryClient.invalidateQueries({ queryKey: ["setlists"] });
            break;
          case "setlist_items":
            queryClient.invalidateQueries({ queryKey: ["setlists"] });
            queryClient.invalidateQueries({ queryKey: ["setlist_items"] });
            break;
          case "play_events":
            queryClient.invalidateQueries({ queryKey: ["play_events"] });
            break;
          case "reset_periods":
            queryClient.invalidateQueries({ queryKey: ["reset_periods"] });
            break;
          case "profiles":
            queryClient.invalidateQueries({ queryKey: ["profiles"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            queryClient.invalidateQueries({ queryKey: ["my-profile"] });
            break;
          case "role_requests":
            queryClient.invalidateQueries({ queryKey: ["role_requests"] });
            queryClient.invalidateQueries({ queryKey: ["pending-admin-badge"] });
            break;
          case "user_roles":
            queryClient.invalidateQueries({ queryKey: ["profiles"] });
            break;
          case "notices":
            queryClient.invalidateQueries({ queryKey: ["notices"] });
            break;
          case "notice_comments":
            queryClient.invalidateQueries({ queryKey: ["notice-comments"] });
            break;
          case "notice_likes":
            queryClient.invalidateQueries({ queryKey: ["notice-likes"] });
            break;
          case "bolo_messages":
            queryClient.invalidateQueries({ queryKey: ["bolo_messages"] });
            break;
          case "drive_folders":
            queryClient.invalidateQueries({ queryKey: ["drive_folders"] });
            break;
          // social_posts y social_comments ya se manejan en useSocialRealtime, pero es seguro invalidar aquí
          case "social_posts":
            queryClient.invalidateQueries({ queryKey: ["social_posts"] });
            break;
          case "social_comments":
            queryClient.invalidateQueries({ queryKey: ["social_comments"] });
            break;
          case "social_templates":
            queryClient.invalidateQueries({ queryKey: ["social_templates"] });
            break;
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
