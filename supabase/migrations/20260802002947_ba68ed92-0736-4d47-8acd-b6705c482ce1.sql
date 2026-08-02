ALTER TABLE public.street_songs ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "calle: escribir admin" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir autenticados" ON public.street_songs;
CREATE POLICY "calle: escribir autenticados" ON public.street_songs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "arreglos: escribir admin" ON public.arrangements;
DROP POLICY IF EXISTS "arreglos: escribir autenticados" ON public.arrangements;
CREATE POLICY "arreglos: escribir autenticados" ON public.arrangements FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir autenticados" ON public.setlists;
CREATE POLICY "setlists: escribir autenticados" ON public.setlists FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "setlist items: escribir admin" ON public.setlist_items;
DROP POLICY IF EXISTS "setlist items: escribir autenticados" ON public.setlist_items;
CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "letras: escribir admin" ON public.lyrics;
DROP POLICY IF EXISTS "letras: escribir autenticados" ON public.lyrics;
CREATE POLICY "letras: escribir autenticados" ON public.lyrics FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.setlist_items ALTER COLUMN arrangement_id DROP NOT NULL;
ALTER TABLE public.setlist_items ADD COLUMN IF NOT EXISTS manual_title text;
ALTER TABLE public.setlist_items ADD COLUMN IF NOT EXISTS manual_duration_seconds integer;

COMMENT ON COLUMN public.setlist_items.manual_title IS 'Título de una canción fuera de repertorio (arrangement_id NULL)';
COMMENT ON COLUMN public.setlist_items.manual_duration_seconds IS 'Duración en segundos de una canción fuera de repertorio';