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
