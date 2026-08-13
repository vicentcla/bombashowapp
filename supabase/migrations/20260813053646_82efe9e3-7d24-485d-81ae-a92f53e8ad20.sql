-- Publicar user_roles en Supabase Realtime para que los cambios de rol
-- se propaguen en tiempo real a los clientes afectados sin necesidad de recargar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_roles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
    END IF;
  END IF;
END;
$$;