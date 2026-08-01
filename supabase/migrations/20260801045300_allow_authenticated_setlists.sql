-- Permitir a todos los miembros autenticados crear, actualizar y borrar setlists y sus items
DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
CREATE POLICY "setlists: escribir autenticados" ON public.setlists FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "setlist items: escribir admin" ON public.setlist_items;
CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
