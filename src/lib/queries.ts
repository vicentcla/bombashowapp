import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Scope = "street" | "arrangement";

export type Arrangement = {
  id: string;
  title: string;
  duration_seconds: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type StreetSong = { id: string; title: string; created_at: string };

export type Lyric = {
  id: string;
  kind: string;
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

export function useArrangements() {
  return useQuery({
    queryKey: ["arrangements"],
    queryFn: async (): Promise<Arrangement[]> => {
      const { data, error } = await supabase
        .from("arrangements")
        .select("*")
        .order("title", { ascending: true });
      if (error) throw error;
      return data as Arrangement[];
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
        .order("title", { ascending: true });
      if (error) throw error;
      return data as StreetSong[];
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
      return data as Lyric[];
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Setlist[];
    },
  });
}

export function useSetlistItems(setlistId: string | null) {
  return useQuery({
    queryKey: ["setlist_items", setlistId],
    enabled: !!setlistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlist_items")
        .select("id, position, arrangement_id, arrangements(id, title, duration_seconds, tags)")
        .eq("setlist_id", setlistId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        position: number;
        arrangement_id: string;
        arrangements: Arrangement | null;
      }[];
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

export function useAddPlay(scope: Scope) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ songId, delta }: { songId: string; delta: 1 | -1 }) => {
      const idField = scope === "street" ? "street_song_id" : "arrangement_id";

      if (delta === -1) {
        const { data: last, error: findError } = await supabase
          .from("play_events")
          .select("id")
          .eq("scope", scope)
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

      let { data: period, error: periodError } = await supabase
        .from("reset_periods")
        .select("id")
        .eq("scope", scope)
        .is("ended_at", null)
        .maybeSingle();
      if (periodError) throw periodError;

      if (!period) {
        const { data: created, error: createError } = await supabase
          .from("reset_periods")
          .insert({ scope })
          .select("id")
          .single();
        if (createError) throw createError;
        period = created;
      }

      const { error } = await supabase.from("play_events").insert({
        scope,
        period_id: period.id,
        street_song_id: scope === "street" ? songId : null,
        arrangement_id: scope === "arrangement" ? songId : null,
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
      const now = new Date().toISOString();
      const { error: closeError } = await supabase
        .from("reset_periods")
        .update({ ended_at: now })
        .eq("scope", scope)
        .is("ended_at", null);
      if (closeError) throw closeError;
      const { error } = await supabase
        .from("reset_periods")
        .insert({ scope, label: label || null });
      if (error) throw error;
    },
    onSuccess: () => invalidate("play_events", "reset_periods"),
  });
}
