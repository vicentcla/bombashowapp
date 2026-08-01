-- Canciones fuera de repertorio: permitir items manuales en setlist_items.
-- Un item manual tiene arrangement_id NULL y manual_title no nulo.
ALTER TABLE public.setlist_items
  ALTER COLUMN arrangement_id DROP NOT NULL,
  ADD COLUMN manual_title text,
  ADD COLUMN manual_duration_seconds integer;

COMMENT ON COLUMN public.setlist_items.manual_title IS 'Título de una canción fuera de repertorio (arrangement_id NULL)';
COMMENT ON COLUMN public.setlist_items.manual_duration_seconds IS 'Duración en segundos de una canción fuera de repertorio';
