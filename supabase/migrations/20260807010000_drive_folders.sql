-- Carpetas de Google Drive por instrumento (Partituras)
CREATE TABLE IF NOT EXISTS public.drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  name text NOT NULL,
  folder_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_folders TO authenticated;
GRANT ALL ON public.drive_folders TO service_role;
ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drive folders: leer autenticados" ON public.drive_folders
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "drive folders: escribir admin" ON public.drive_folders
  FOR ALL TO authenticated
  USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));
