-- Tabla de comentarios para el tablón de avisos
CREATE TABLE public.notice_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.notice_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_comments TO authenticated;
GRANT ALL ON public.notice_comments TO service_role;
ALTER TABLE public.notice_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios tablón: leer autenticados" ON public.notice_comments
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "comentarios tablón: escribir admin" ON public.notice_comments
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

CREATE INDEX notice_comments_notice_id_idx ON public.notice_comments (notice_id);
CREATE INDEX notice_comments_parent_id_idx ON public.notice_comments (parent_id);
CREATE INDEX notice_comments_created_at_idx ON public.notice_comments (created_at);

-- Tabla de me gusta para el tablón de avisos
CREATE TABLE public.notice_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (notice_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notice_likes TO authenticated;
GRANT ALL ON public.notice_likes TO service_role;
ALTER TABLE public.notice_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "me gusta tablón: leer autenticados" ON public.notice_likes
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "me gusta tablón: escribir admin" ON public.notice_likes
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

CREATE INDEX notice_likes_notice_id_idx ON public.notice_likes (notice_id);
CREATE INDEX notice_likes_user_id_idx ON public.notice_likes (user_id);

-- Habilitar realtime para comentarios y me gusta de avisos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notice_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_comments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notice_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_likes;
  END IF;
END $$;