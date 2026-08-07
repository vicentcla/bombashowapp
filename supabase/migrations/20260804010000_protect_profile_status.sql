-- =============================================================
-- Proteger el estado de aprobación: solo admin/superadmin pueden
-- cambiarlo. Impide que un usuario se auto-apruebe o se rechace
-- editando su propio perfil.
-- =============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT private.has_admin_power(auth.uid()) THEN
      RAISE EXCEPTION 'Solo los administradores pueden cambiar el estado de aprobación';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.protect_profile_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_profile_status() TO authenticated, service_role;

DROP TRIGGER IF EXISTS protect_profile_status ON public.profiles;
CREATE TRIGGER protect_profile_status
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();
