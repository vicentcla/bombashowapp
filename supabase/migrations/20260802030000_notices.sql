-- Tablón de avisos: los admins crean/editan/borran, todos los miembros leen
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
