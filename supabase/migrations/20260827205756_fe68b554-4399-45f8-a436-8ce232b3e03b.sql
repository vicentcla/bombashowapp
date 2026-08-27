CREATE TABLE IF NOT EXISTS public.notice_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid REFERENCES public.notices(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.notice_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notice_likes_target_check CHECK (
    (notice_id IS NOT NULL AND comment_id IS NULL) OR
    (notice_id IS NULL AND comment_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS notice_likes_notice_user_idx
  ON public.notice_likes (notice_id, user_id) WHERE notice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notice_likes_comment_user_idx
  ON public.notice_likes (comment_id, user_id) WHERE comment_id IS NOT NULL;

GRANT SELECT, INSERT, DELETE ON public.notice_likes TO authenticated;
GRANT ALL ON public.notice_likes TO service_role;

ALTER TABLE public.notice_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notice_likes: leer autenticados" ON public.notice_likes;
CREATE POLICY "notice_likes: leer autenticados" ON public.notice_likes
  FOR SELECT TO authenticated USING (private.is_approved());

DROP POLICY IF EXISTS "notice_likes: insertar propio" ON public.notice_likes;
CREATE POLICY "notice_likes: insertar propio" ON public.notice_likes
  FOR INSERT TO authenticated WITH CHECK (private.is_approved() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "notice_likes: borrar propio" ON public.notice_likes;
CREATE POLICY "notice_likes: borrar propio" ON public.notice_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);