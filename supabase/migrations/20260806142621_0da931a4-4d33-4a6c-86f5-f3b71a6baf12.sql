DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('miembro', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';