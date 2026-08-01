-- Añadir columna tags a street_songs si no existe
ALTER TABLE public.street_songs ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Permitir a todos los autenticados escribir en setlists y setlist_items
DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
CREATE POLICY "setlists: escribir autenticados" ON public.setlists FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "setlist items: escribir admin" ON public.setlist_items;
CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
