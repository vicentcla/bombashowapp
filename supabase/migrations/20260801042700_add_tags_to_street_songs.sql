ALTER TABLE public.street_songs ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
