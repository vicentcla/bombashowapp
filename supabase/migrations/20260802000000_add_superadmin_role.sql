-- Añadir el rol de superadmin al enum de roles.
-- Se hace en su propio archivo porque los nuevos valores de un enum
-- no pueden usarse en el mismo script donde se añaden.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
