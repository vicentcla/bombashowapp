REVOKE ALL ON public.arrangements, public.street_songs, public.lyrics, public.setlists, public.setlist_items,
  public.play_events, public.reset_periods, public.role_requests, public.user_roles,
  public.social_posts, public.social_comments, public.profiles FROM anon;

CREATE INDEX IF NOT EXISTS setlist_items_setlist_id_idx ON public.setlist_items (setlist_id, position);
CREATE INDEX IF NOT EXISTS lyrics_arrangement_id_idx ON public.lyrics (arrangement_id);
CREATE INDEX IF NOT EXISTS lyrics_street_song_id_idx ON public.lyrics (street_song_id);
CREATE INDEX IF NOT EXISTS play_events_arrangement_idx ON public.play_events (arrangement_id);
CREATE INDEX IF NOT EXISTS play_events_street_song_idx ON public.play_events (street_song_id);
CREATE INDEX IF NOT EXISTS role_requests_user_id_idx ON public.role_requests (user_id);