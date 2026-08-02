-- Redes Sociales: textos de publicaciones (copies) + comentarios
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  network text NOT NULL DEFAULT 'instagram' CHECK (network IN ('instagram', 'tiktok', 'whatsapp')),
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'en_revision', 'aprobado')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redes: leer autenticados" ON public.social_posts
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "redes: escribir autenticados" ON public.social_posts
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE TABLE public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comments TO authenticated;
GRANT ALL ON public.social_comments TO service_role;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comentarios: leer autenticados" ON public.social_comments
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "comentarios: escribir autenticados" ON public.social_comments
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE INDEX social_posts_updated_at_idx ON public.social_posts (updated_at DESC);
CREATE INDEX social_comments_post_id_idx ON public.social_comments (post_id);
