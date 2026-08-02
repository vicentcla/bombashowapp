-- Colaboración en redes: quién editó por última vez, comentarios anclados y realtime
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.social_comments
  ADD COLUMN IF NOT EXISTS start_offset integer,
  ADD COLUMN IF NOT EXISTS end_offset integer,
  ADD COLUMN IF NOT EXISTS snippet text NOT NULL DEFAULT '';

-- Al actualizar un post, registrar quién lo tocó y cuándo (lado servidor)
CREATE OR REPLACE FUNCTION public.set_social_post_updated_by() RETURNS trigger AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_social_post_updated_by ON public.social_posts;
CREATE TRIGGER set_social_post_updated_by
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_social_post_updated_by();

-- Habilitar realtime para posts y comentarios (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'social_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'social_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_comments;
  END IF;
END $$;
