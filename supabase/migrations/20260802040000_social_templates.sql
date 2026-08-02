-- Plantillas de redes sociales: esquemas reutilizables (nombre + red + copy)
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
