-- Comentarios y conversaciones estilo Instagram en el tablón de avisos
CREATE TABLE IF NOT EXISTS public.notice_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.notice_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_comments TO authenticated;
GRANT ALL ON public.notice_comments TO service_role;
ALTER TABLE public.notice_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notice_comments: leer autenticados" ON public.notice_comments;
CREATE POLICY "notice_comments: leer autenticados" ON public.notice_comments
  FOR SELECT TO authenticated USING (private.is_approved());

DROP POLICY IF EXISTS "notice_comments: escribir autenticados" ON public.notice_comments;
CREATE POLICY "notice_comments: escribir autenticados" ON public.notice_comments
  FOR INSERT TO authenticated WITH CHECK (private.is_approved() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "notice_comments: borrar propio o admin" ON public.notice_comments;
CREATE POLICY "notice_comments: borrar propio o admin" ON public.notice_comments
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR private.has_admin_power(auth.uid())
  );

CREATE INDEX IF NOT EXISTS notice_comments_notice_id_idx ON public.notice_comments (notice_id);
CREATE INDEX IF NOT EXISTS notice_comments_parent_id_idx ON public.notice_comments (parent_id);

-- Habilitar Supabase Realtime si existe la publicación
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notice_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_comments;
    END IF;
  END IF;
END $$;
