-- Habilitar la replicación en tiempo real para todas las tablas principales

DO $$
BEGIN
    -- Crear la publicación si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Añadir tablas si no están ya en la publicación
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'arrangements') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.arrangements;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'street_songs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.street_songs;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lyrics') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lyrics;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'setlists') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.setlists;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'setlist_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.setlist_items;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'play_events') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.play_events;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reset_periods') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reset_periods;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'role_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.role_requests;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notice_comments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_comments;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notice_likes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_likes;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bolo_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bolo_messages;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'drive_folders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.drive_folders;
    END IF;

END $$;
