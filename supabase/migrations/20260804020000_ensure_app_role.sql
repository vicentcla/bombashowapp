-- =============================================================
-- SCRIPT 1 (ejecutar PRIMERO, solo este)
-- Tipos: enum de roles (miembro, admin, superadmin).
-- Se ejecuta en su propio paso porque ALTER TYPE ... ADD VALUE no
-- puede usarse en la misma transacción donde luego se referencia.
-- =============================================================

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('miembro', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
