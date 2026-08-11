-- Orden manual de setlists: añade sort_order y preserva el orden actual (más reciente arriba)
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn
  FROM public.setlists
)
UPDATE public.setlists s
SET sort_order = ranked.rn
FROM ranked
WHERE s.id = ranked.id;

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

DROP POLICY IF EXISTS "drive folders: leer autenticados" ON public.drive_folders;
CREATE POLICY "drive folders: leer autenticados" ON public.drive_folders
  FOR SELECT TO authenticated USING (private.is_approved());
DROP POLICY IF EXISTS "drive folders: escribir admin" ON public.drive_folders;
CREATE POLICY "drive folders: escribir admin" ON public.drive_folders
  FOR ALL TO authenticated
  USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
UPDATE public.setlists s SET sort_order = t.rn FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.setlists) t WHERE s.id = t.id AND s.sort_order = 0;

NOTIFY pgrst, 'reload schema';