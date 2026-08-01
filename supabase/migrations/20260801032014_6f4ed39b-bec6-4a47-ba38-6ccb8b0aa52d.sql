ALTER TABLE public.street_songs ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

DROP POLICY IF EXISTS "calle: leer autenticados" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir admin" ON public.street_songs;
CREATE POLICY "calle: leer autenticados" ON public.street_songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "calle: escribir admin" ON public.street_songs FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "setlists: leer autenticados" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
CREATE POLICY "setlists: leer autenticados" ON public.setlists FOR SELECT TO authenticated USING (true);
CREATE POLICY "setlists: escribir admin" ON public.setlists FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.street_songs TO authenticated;
GRANT ALL ON public.street_songs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setlists TO authenticated;
GRANT ALL ON public.setlists TO service_role;