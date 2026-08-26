import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAuth";
import type { Json } from "@/integrations/supabase/types";

/** Los ámbitos son los mismos valores que acepta la base de datos. */
export type Scope = "calle" | "arreglo";

export type Arrangement = {
  id: string;
  title: string;
  duration_seconds: number;
  tags: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StreetSong = {
  id: string;
  title: string;
  tags?: string[];
  sort_order: number;
  created_at: string;
};

export type Lyric = {
  id: string;
  kind: Scope;
  title: string;
  content: string;
  plain_text: string;
  arrangement_id: string | null;
  street_song_id: string | null;
  updated_at: string;
};

export type Setlist = {
  id: string;
  name: string;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  sort_order: number;
};

export type PlayEvent = {
  id: string;
  scope: string;
  arrangement_id: string | null;
  street_song_id: string | null;
  period_id: string | null;
  played_at: string;
};

export type ResetPeriod = {
  id: string;
  scope: string;
  label: string | null;
  started_at: string;
  ended_at: string | null;
};

export type RoleRequest = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type DriveFolder = {
  id: string;
  instrument: string;
  name: string;
  folder_id: string;
  sort_order: number;
  created_at: string;
};

export function useArrangements() {
  return useQuery({
    queryKey: ["arrangements"],
    queryFn: async (): Promise<Arrangement[]> => {
      const { data, error } = await supabase
        .from("arrangements")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return data as unknown as Arrangement[];
    },
  });
}

export function useStreetSongs() {
  return useQuery({
    queryKey: ["street_songs"],
    queryFn: async (): Promise<StreetSong[]> => {
      const { data, error } = await supabase
        .from("street_songs")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      if (error) throw error;
      return data as unknown as StreetSong[];
    },
  });
}

export function useLyrics() {
  return useQuery({
    queryKey: ["lyrics"],
    queryFn: async (): Promise<Lyric[]> => {
      const { data, error } = await supabase
        .from("lyrics")
        .select("*")
        .order("title", { ascending: true });
      if (error) throw error;
      return data as unknown as Lyric[];
    },
  });
}

export function useSetlists() {
  return useQuery({
    queryKey: ["setlists"],
    queryFn: async (): Promise<Setlist[]> => {
      const { data, error } = await supabase
        .from("setlists")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Setlist[];
    },
  });
}

export function useDriveFolders() {
  return useQuery({
    queryKey: ["drive_folders"],
    queryFn: async (): Promise<DriveFolder[]> => {
      const { data, error } = await supabase
        .from("drive_folders")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DriveFolder[];
    },
  });
}

export type SetlistItem = {
  id: string;
  position: number;
  arrangement_id: string | null;
  manual_title: string | null;
  manual_duration_seconds: number | null;
  arrangements: Arrangement | null;
};

export function useSetlistItems(setlistId: string | null) {
  return useQuery({
    queryKey: ["setlist_items", setlistId],
    enabled: !!setlistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlist_items")
        .select(
          "id, position, arrangement_id, manual_title, manual_duration_seconds, arrangements(id, title, duration_seconds, tags)",
        )
        .eq("setlist_id", setlistId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SetlistItem[];
    },
  });
}

export function usePlayEvents(scope: Scope) {
  return useQuery({
    queryKey: ["play_events", scope],
    queryFn: async (): Promise<PlayEvent[]> => {
      const { data, error } = await supabase
        .from("play_events")
        .select("*")
        .eq("scope", scope)
        .order("played_at", { ascending: false });
      if (error) throw error;
      return data as PlayEvent[];
    },
  });
}

export function usePeriods(scope: Scope) {
  return useQuery({
    queryKey: ["reset_periods", scope],
    queryFn: async (): Promise<ResetPeriod[]> => {
      const { data, error } = await supabase
        .from("reset_periods")
        .select("*")
        .eq("scope", scope)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as ResetPeriod[];
    },
  });
}

export function useCurrentPeriod(scope: Scope) {
  const { data: periods, ...rest } = usePeriods(scope);
  return { ...rest, data: periods?.find((p) => p.ended_at === null) ?? null, periods };
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    for (const key of keys) qc.invalidateQueries({ queryKey: [key] });
  };
}

async function ensurePeriod(scope: Scope) {
  const { data: period, error } = await supabase
    .from("reset_periods")
    .select("id")
    .eq("scope", scope)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (period) return period.id;

  const { data: created, error: createError } = await supabase
    .from("reset_periods")
    .insert({ scope })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

export function useAddPlay(scope: Scope) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ songId, delta }: { songId: string; delta: 1 | -1 }) => {
      const idField = scope === "calle" ? "street_song_id" : "arrangement_id";
      const periodId = await ensurePeriod(scope);

      if (delta === -1) {
        const { data: last, error: findError } = await supabase
          .from("play_events")
          .select("id")
          .eq("scope", scope)
          .eq("period_id", periodId)
          .eq(idField, songId)
          .order("played_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (findError) throw findError;
        if (!last) return;
        const { error } = await supabase.from("play_events").delete().eq("id", last.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("play_events").insert({
        scope,
        period_id: periodId,
        street_song_id: scope === "calle" ? songId : null,
        arrangement_id: scope === "arreglo" ? songId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate("play_events", "reset_periods"),
  });
}

export function useResetCounters(scope: Scope) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (label: string) => {
      const patch: { ended_at: string; label?: string } = { ended_at: new Date().toISOString() };
      if (label.trim()) patch.label = label.trim();
      const { error: closeError } = await supabase
        .from("reset_periods")
        .update(patch)
        .eq("scope", scope)
        .is("ended_at", null);
      if (closeError) throw closeError;
      const { error } = await supabase.from("reset_periods").insert({ scope });
      if (error) throw error;
    },
    onSuccess: () => invalidate("play_events", "reset_periods"),
  });
}

/** Guarda el nuevo orden manual de una lista. */
export function useReorder(table: "arrangements" | "street_songs" | "setlists") {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from(table)
            .update({ sort_order: index + 1 })
            .eq("id", id),
        ),
      );
    },
    onSuccess: () => invalidate(table),
  });
}

export function useRoleRequests() {
  return useQuery({
    queryKey: ["role_requests"],
    queryFn: async (): Promise<RoleRequest[]> => {
      const { data, error } = await supabase
        .from("role_requests")
        .select("id, user_id, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RoleRequest[];
    },
  });
}

export type SocialNetwork = "instagram" | "tiktok";

export type SocialPostStatus = "borrador" | "en_revision" | "aprobado";

export type SocialPost = {
  id: string;
  title: string;
  content: string;
  network: SocialNetwork;
  status: SocialPostStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  comments: { count: number }[] | null;
};

export type SocialComment = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  start_offset: number | null;
  end_offset: number | null;
  snippet: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
};

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Profile[];
    },
  });
}

export function useSocialPosts() {
  return useQuery({
    queryKey: ["social_posts"],
    queryFn: async (): Promise<SocialPost[]> => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*, comments:social_comments(count)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SocialPost[];
    },
  });
}

export function useSocialComments(postId: string | null) {
  return useQuery({
    queryKey: ["social_comments", postId],
    enabled: !!postId,
    queryFn: async (): Promise<SocialComment[]> => {
      const { data, error } = await supabase
        .from("social_comments")
        .select("*")
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SocialComment[];
    },
  });
}

export function useSaveSocialPost() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      content: string;
      network: SocialNetwork;
      status: SocialPostStatus;
    }): Promise<string> => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("social_posts")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("social_posts")
        .insert({ ...rest })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidate("social_posts"),
  });
}

export function useDeleteSocialPost() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("social_posts", "social_comments"),
  });
}

export function useAddComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      postId,
      body,
      anchor,
    }: {
      postId: string;
      body: string;
      anchor?: { start_offset: number; end_offset: number; snippet: string };
    }) => {
      const { error } = await supabase
        .from("social_comments")
        .insert({ post_id: postId, body, ...anchor });
      if (error) throw error;
    },
    onSuccess: () => invalidate("social_posts", "social_comments"),
  });
}

export function useDeleteComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, postId }: { id: string; postId: string }) => {
      const { error } = await supabase.from("social_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("social_posts", "social_comments"),
  });
}

export type SocialTemplate = {
  id: string;
  name: string;
  content: string;
  network: SocialNetwork;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function useSocialTemplates() {
  return useQuery({
    queryKey: ["social_templates"],
    queryFn: async (): Promise<SocialTemplate[]> => {
      const { data, error } = await supabase
        .from("social_templates")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SocialTemplate[];
    },
  });
}

export function useSaveSocialTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      content: string;
      network: SocialNetwork;
    }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("social_templates")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("social_templates").insert({ ...rest });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate("social_templates"),
  });
}

export function useDeleteSocialTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("social_templates"),
  });
}

export type Notice = {
  id: string;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
};

export type NoticeComment = {
  id: string;
  content: string;
  created_at: string;
  notice_id: string;
  parent_id: string | null;
  user_id: string;
  user_name: string | null;
};

export type NoticeCommentForm = {
  content: string;
  parent_id: string | null;
};

export type NoticeLike = {
  id: string;
  notice_id: string;
  user_id: string;
};

export function useNotices() {
  return useQuery({
    queryKey: ["notices"],
    queryFn: async (): Promise<Notice[]> => {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Notice[];
    },
  });
}

export function useSaveNotice() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { id?: string; title: string; body: string }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("notices")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notices").insert({ ...rest });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate("notices"),
  });
}

export function useDeleteNotice() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("notices"),
  });
}

export function useAddNoticeComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      noticeId,
      content,
      parentId,
    }: {
      noticeId: string;
      content: string;
      parentId?: string | null;
    }) => {
      const { error } = await supabase
        .from("notice_comments")
        .insert({ notice_id: noticeId, content, parent_id: parentId ?? null });
      if (error) throw error;
    },
    onSuccess: () => invalidate("notices", "notice_comments"),
  });
}

export function useDeleteNoticeComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("notice_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("notices", "notice_comments"),
  });
}

export function useNoticeComments(noticeId: string | null) {
  return useQuery({
    queryKey: ["notice_comments", noticeId],
    enabled: !!noticeId,
    queryFn: async (): Promise<NoticeComment[]> => {
      const { data, error } = await supabase
        .from("notice_comments")
        .select("*")
        .eq("notice_id", noticeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as NoticeComment[];
    },
  });
}

/** Todos los comentarios de avisos, agrupados por aviso. */
export function useAllNoticeComments() {
  return useQuery({
    queryKey: ["notice_comments", "all"],
    queryFn: async (): Promise<Record<string, NoticeComment[]>> => {
      const { data, error } = await supabase
        .from("notice_comments")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, NoticeComment[]> = {};
      for (const row of (data ?? []) as unknown as NoticeComment[]) {
        (grouped[row.notice_id] ??= []).push(row);
      }
      return grouped;
    },
  });
}

export type BoloTemplate = "fiestas" | "suelto" | "generico";

export type BoloMessage = {
  id: string;
  title: string;
  day: string;
  time: string;
  location: string;
  maps_url: string;
  attendees: string[];
  clothing: string;
  template: BoloTemplate;
  data: Json;
  message: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export function useBoloMessages() {
  return useQuery({
    queryKey: ["bolo_messages"],
    queryFn: async (): Promise<BoloMessage[]> => {
      const { data, error } = await supabase
        .from("bolo_messages")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BoloMessage[];
    },
  });
}

export function useSaveBoloMessage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      template: BoloTemplate;
      data: Json;
      message: string;
    }): Promise<string> => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase
          .from("bolo_messages")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("bolo_messages")
        .insert({ ...rest })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidate("bolo_messages"),
  });
}

export function useDeleteBoloMessage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bolo_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("bolo_messages"),
  });
}

export function useTabOrder(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-tab-order", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      // tab_order no existe en los tipos generados de Supabase (migración nueva).
      const builder = supabase.from("profiles") as unknown as {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { tab_order: string[] | null } | null;
              error: Error | null;
            }>;
          };
        };
      };
      const res = await builder.select("tab_order").eq("id", userId!).maybeSingle();
      if (res.error) throw res.error;
      return res.data?.tab_order ?? [];
    },
  });
}

/** Número de tareas pendientes de admin (usuarios, peticiones y propuestas). */
export function usePendingCount() {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["pending-admin-badge"],
    enabled: isAdmin,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [profilesRes, requestsRes, setlistsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("role_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("setlists").select("notes"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (setlistsRes.error) throw setlistsRes.error;

      let proposals = 0;
      for (const row of setlistsRes.data ?? []) {
        try {
          const parsed = JSON.parse(row.notes ?? "");
          for (const p of parsed?.proposals ?? []) {
            if (p?.status === "pending") proposals += 1;
          }
        } catch {
          // notes en texto plano: sin propuestas
        }
      }

      return (profilesRes.count ?? 0) + (requestsRes.count ?? 0) + proposals;
    },
  });
}
