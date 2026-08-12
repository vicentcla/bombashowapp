-- =============================================================
-- Orden personalizable de pestañas de la barra inferior por usuario.
-- =============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tab_order text[] NOT NULL DEFAULT '{}';

-- SELECT está restringido por columnas tras los REVOKE previos;
-- el UPDATE de tabla ya cubre la nueva columna.
GRANT SELECT (tab_order) ON public.profiles TO authenticated;
