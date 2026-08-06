CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_admin_power(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'superadmin'::public.app_role)
  )
$$;
REVOKE ALL ON FUNCTION private.has_admin_power(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_admin_power(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved')
$$;
REVOKE ALL ON FUNCTION private.is_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_approved() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_profile_email(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (auth.uid() = p.id OR private.has_admin_power(auth.uid()))
$$;
REVOKE ALL ON FUNCTION public.get_profile_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $set_updated_at$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$set_updated_at$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, created_at, status, onboarded_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin'::public.app_role)
      THEN 'approved'
      ELSE 'pending'
    END
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin'::public.app_role) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'superadmin'::public.app_role)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'miembro'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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

DROP TRIGGER IF EXISTS update_role_requests_updated_at ON public.role_requests;
CREATE TRIGGER update_role_requests_updated_at
BEFORE UPDATE ON public.role_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "perfiles visibles para autenticados" ON public.profiles;
DROP POLICY IF EXISTS "perfiles: gestionar estado admin" ON public.profiles;
DROP POLICY IF EXISTS "cada uno edita su perfil" ON public.profiles;
DROP POLICY IF EXISTS "cada uno crea su perfil" ON public.profiles;
CREATE POLICY "perfiles visibles para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (private.is_approved() OR auth.uid() = id);
CREATE POLICY "cada uno crea su perfil" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "cada uno edita su perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "perfiles: gestionar estado admin" ON public.profiles
  FOR UPDATE TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

DROP POLICY IF EXISTS "roles visibles para autenticados" ON public.user_roles;
DROP POLICY IF EXISTS "roles: gestionar admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles: gestionar superadmin" ON public.user_roles;
CREATE POLICY "roles visibles para autenticados" ON public.user_roles
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "roles: gestionar superadmin" ON public.user_roles
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'superadmin'::public.app_role));

DROP POLICY IF EXISTS "solicitudes: ver propias o admin" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: crear la propia" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: gestionar admin" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: borrar admin" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: gestionar superadmin" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: borrar superadmin" ON public.role_requests;
CREATE POLICY "solicitudes: ver propias o admin" ON public.role_requests
  FOR SELECT TO authenticated
  USING (private.is_approved() AND (user_id = auth.uid() OR private.has_admin_power(auth.uid())));
CREATE POLICY "solicitudes: crear la propia" ON public.role_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND private.is_approved());
CREATE POLICY "solicitudes: gestionar superadmin" ON public.role_requests
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'superadmin'::public.app_role));
CREATE POLICY "solicitudes: borrar superadmin" ON public.role_requests
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'superadmin'::public.app_role));

DO $$
BEGIN
  IF to_regclass('public.arrangements') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "arreglos: leer autenticados" ON public.arrangements';
    EXECUTE 'DROP POLICY IF EXISTS "arreglos: escribir autenticados" ON public.arrangements';
    EXECUTE 'CREATE POLICY "arreglos: leer autenticados" ON public.arrangements FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "arreglos: escribir autenticados" ON public.arrangements FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved())';
  END IF;
  IF to_regclass('public.street_songs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "calle: leer autenticados" ON public.street_songs';
    EXECUTE 'DROP POLICY IF EXISTS "calle: escribir autenticados" ON public.street_songs';
    EXECUTE 'CREATE POLICY "calle: leer autenticados" ON public.street_songs FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "calle: escribir autenticados" ON public.street_songs FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved())';
  END IF;
  IF to_regclass('public.lyrics') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "letras: leer autenticados" ON public.lyrics';
    EXECUTE 'DROP POLICY IF EXISTS "letras: escribir autenticados" ON public.lyrics';
    EXECUTE 'CREATE POLICY "letras: leer autenticados" ON public.lyrics FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "letras: escribir autenticados" ON public.lyrics FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved())';
  END IF;
  IF to_regclass('public.setlists') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "setlists: leer autenticados" ON public.setlists';
    EXECUTE 'DROP POLICY IF EXISTS "setlists: escribir autenticados" ON public.setlists';
    EXECUTE 'CREATE POLICY "setlists: leer autenticados" ON public.setlists FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "setlists: escribir autenticados" ON public.setlists FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved())';
  END IF;
  IF to_regclass('public.setlist_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "setlist items: leer autenticados" ON public.setlist_items';
    EXECUTE 'DROP POLICY IF EXISTS "setlist items: escribir autenticados" ON public.setlist_items';
    EXECUTE 'CREATE POLICY "setlist items: leer autenticados" ON public.setlist_items FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved())';
  END IF;
  IF to_regclass('public.reset_periods') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "periodos: leer autenticados" ON public.reset_periods';
    EXECUTE 'DROP POLICY IF EXISTS "periodos: escribir admin" ON public.reset_periods';
    EXECUTE 'CREATE POLICY "periodos: leer autenticados" ON public.reset_periods FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "periodos: escribir admin" ON public.reset_periods FOR ALL TO authenticated USING (private.has_admin_power(auth.uid())) WITH CHECK (private.has_admin_power(auth.uid()))';
  END IF;
  IF to_regclass('public.play_events') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "toques: leer autenticados" ON public.play_events';
    EXECUTE 'DROP POLICY IF EXISTS "toques: escribir admin" ON public.play_events';
    EXECUTE 'CREATE POLICY "toques: leer autenticados" ON public.play_events FOR SELECT TO authenticated USING (private.is_approved())';
    EXECUTE 'CREATE POLICY "toques: escribir admin" ON public.play_events FOR ALL TO authenticated USING (private.has_admin_power(auth.uid())) WITH CHECK (private.has_admin_power(auth.uid()))';
  END IF;
END $$;

UPDATE public.profiles
SET onboarded_at = COALESCE(created_at, now())
WHERE status = 'approved'
  AND display_name IS NOT NULL
  AND onboarded_at IS NULL;

UPDATE public.user_roles ur
SET role = 'superadmin'
WHERE ur.role = 'admin'
  AND ur.user_id = (
    SELECT ur2.user_id FROM public.user_roles ur2
    WHERE ur2.role = 'admin'
    ORDER BY ur2.created_at ASC, ur2.user_id ASC
    LIMIT 1
  )
  AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'superadmin');

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'superadmin'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.role IN ('admin'::public.app_role, 'superadmin'::public.app_role)
)
ORDER BY p.created_at ASC, p.id ASC
LIMIT 1
ON CONFLICT DO NOTHING;