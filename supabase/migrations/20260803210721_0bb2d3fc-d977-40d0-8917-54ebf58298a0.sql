CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avisos: leer autenticados" ON public.notices
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "avisos: escribir admin" ON public.notices
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

CREATE INDEX notices_updated_at_idx ON public.notices (updated_at DESC);

CREATE TABLE public.social_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  network text NOT NULL DEFAULT 'instagram' CHECK (network IN ('instagram', 'tiktok')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_templates TO authenticated;
GRANT ALL ON public.social_templates TO service_role;
ALTER TABLE public.social_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantillas: leer autenticados" ON public.social_templates
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "plantillas: escribir autenticados" ON public.social_templates
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE INDEX social_templates_updated_at_idx ON public.social_templates (updated_at DESC);

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.social_comments
  ADD COLUMN IF NOT EXISTS start_offset integer,
  ADD COLUMN IF NOT EXISTS end_offset integer,
  ADD COLUMN IF NOT EXISTS snippet text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.set_social_post_updated_by() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.set_social_post_updated_by() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_social_post_updated_by ON public.social_posts;
CREATE TRIGGER set_social_post_updated_by
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_social_post_updated_by();

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