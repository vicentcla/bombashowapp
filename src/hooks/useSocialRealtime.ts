import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { SocialPost } from "@/lib/queries";

export type PresenceUser = { user_id: string; name: string; editing: boolean };

/** Suscripción realtime a los cambios de un post y sus comentarios. */
export function useSocialPostChanges({
  postId,
  onPostUpdate,
  onCommentsChanged,
}: {
  postId: string | null;
  onPostUpdate?: (row: Partial<SocialPost>) => void;
  onCommentsChanged?: () => void;
}) {
  const onPostUpdateRef = useRef(onPostUpdate);
  onPostUpdateRef.current = onPostUpdate;
  const onCommentsChangedRef = useRef(onCommentsChanged);
  onCommentsChangedRef.current = onCommentsChanged;

  useEffect(() => {
    if (!postId) return;
    const channel = supabase
      .channel(`social-changes:${postId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "social_posts", filter: `id=eq.${postId}` },
        (payload) => onPostUpdateRef.current?.(payload.new as Partial<SocialPost>),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_comments",
          filter: `post_id=eq.${postId}`,
        },
        () => onCommentsChangedRef.current?.(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);
}

/** Presencia: quién está viendo/ editando un post ahora mismo. */
export function useSocialPresence(
  postId: string | null,
  self: { user_id: string; name: string } | null,
) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const editingRef = useRef(false);
  const selfRef = useRef(self);
  selfRef.current = self;

  useEffect(() => {
    setUsers([]);
    if (!postId || !self) return;
    const channel = supabase.channel(`presence:social:${postId}`);
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const list: PresenceUser[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences as unknown as PresenceUser[]) {
            list.push({ user_id: p.user_id, name: p.name, editing: p.editing });
          }
        }
        setUsers(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: self.user_id,
            name: self.name,
            editing: editingRef.current,
          });
        }
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, self?.user_id]);

  /** Marca si el usuario actual está editando (se muestra en presencia). */
  function setEditing(editing: boolean) {
    editingRef.current = editing;
    const s = selfRef.current;
    if (s) channelRef.current?.track({ user_id: s.user_id, name: s.name, editing });
  }

  return { users, setEditing };
}
