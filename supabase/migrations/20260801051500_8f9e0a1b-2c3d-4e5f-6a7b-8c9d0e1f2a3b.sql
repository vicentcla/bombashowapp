-- 1. Añadir columna tags a street_songs si no existe
ALTER TABLE public.street_songs ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 2. Permitir a todos los usuarios autenticados escribir en street_songs
DROP POLICY IF EXISTS "calle: escribir admin" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir autenticados" ON public.street_songs;
CREATE POLICY "calle: escribir autenticados" ON public.street_songs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 3. Permitir a todos los usuarios autenticados escribir en arreglos
DROP POLICY IF EXISTS "arreglos: escribir admin" ON public.arrangements;
DROP POLICY IF EXISTS "arreglos: escribir autenticados" ON public.arrangements;
CREATE POLICY "arreglos: escribir autenticados" ON public.arrangements FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 4. Permitir a todos los usuarios autenticados escribir en setlists y setlist_items
DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir autenticados" ON public.setlists;
CREATE POLICY "setlists: escribir autenticados" ON public.setlists FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "setlist items: escribir admin" ON public.setlist_items;
DROP POLICY IF EXISTS "setlist items: escribir autenticados" ON public.setlist_items;
CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 5. Permitir a todos los usuarios autenticados escribir en letras
DROP POLICY IF EXISTS "letras: escribir admin" ON public.lyrics;
DROP POLICY IF EXISTS "letras: escribir autenticados" ON public.lyrics;
CREATE POLICY "letras: escribir autenticados" ON public.lyrics FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
