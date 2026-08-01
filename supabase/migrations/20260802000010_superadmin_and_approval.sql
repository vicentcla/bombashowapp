-- =============================================================
-- Roles: Miembro · Admin · Superadmin + aprobación manual de acceso
-- =============================================================

-- 1) Estado de aprobación en profiles (pending | approved | rejected)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Los usuarios ya existentes quedan aprobados (no se repite la aprobación)
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';

-- Exponer status a los clientes (el email sigue restringido por columna)
GRANT SELECT (id, display_name, created_at, status) ON public.profiles TO authenticated;

-- 2) Helpers de seguridad
-- "Poder de administración" = admin o superadmin (contenido, aprobaciones, periodos)
CREATE OR REPLACE FUNCTION private.has_admin_power(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'superadmin'::public.app_role)
  )
$$;
REVOKE ALL ON FUNCTION private.has_admin_power(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_admin_power(uuid) TO authenticated, service_role;

-- Usuario aprobado (puede ver y usar el contenido)
CREATE OR REPLACE FUNCTION private.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved'
  )
$$;
REVOKE ALL ON FUNCTION private.is_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_approved() TO authenticated, service_role;

-- 3) Alta de usuarios: el primer usuario es superadmin; el resto entran
--    pendientes de aprobación manual.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

-- 4) Datos actuales: el admin más antiguo pasa a ser superadmin.
--    Si no hay ningún admin/superadmin, el usuario más antiguo lo es.
UPDATE public.user_roles ur
SET role = 'superadmin'
WHERE ur.role = 'admin'
  AND ur.user_id = (
    SELECT ur2.user_id FROM public.user_roles ur2
    WHERE ur2.role = 'admin'
    ORDER BY ur2.created_at ASC, ur2.user_id ASC
    LIMIT 1
  );

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'superadmin'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.role IN ('admin'::public.app_role, 'superadmin'::public.app_role)
)
ORDER BY p.created_at ASC
LIMIT 1;

-- 5) Correo de usuarios para administradores (función RPC segura)
CREATE OR REPLACE FUNCTION public.get_profile_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (auth.uid() = p.id OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin'::public.app_role, 'superadmin'::public.app_role)
    ))
$$;
REVOKE ALL ON FUNCTION public.get_profile_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated, service_role;

-- 6) Políticas RLS: solo usuarios aprobados; escritura admin/superadmin
--    donde era admin; el superadmin controla los roles.

-- ARREGLOS
DROP POLICY IF EXISTS "arreglos: leer autenticados" ON public.arrangements;
DROP POLICY IF EXISTS "arreglos: escribir autenticados" ON public.arrangements;
DROP POLICY IF EXISTS "arreglos: escribir admin" ON public.arrangements;
CREATE POLICY "arreglos: leer autenticados" ON public.arrangements
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "arreglos: escribir autenticados" ON public.arrangements
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

-- CANCIONES DE CALLE
DROP POLICY IF EXISTS "calle: leer autenticados" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir autenticados" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir admin" ON public.street_songs;
CREATE POLICY "calle: leer autenticados" ON public.street_songs
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "calle: escribir autenticados" ON public.street_songs
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

-- LETRAS
DROP POLICY IF EXISTS "letras: leer autenticados" ON public.lyrics;
DROP POLICY IF EXISTS "letras: escribir autenticados" ON public.lyrics;
DROP POLICY IF EXISTS "letras: escribir admin" ON public.lyrics;
CREATE POLICY "letras: leer autenticados" ON public.lyrics
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "letras: escribir autenticados" ON public.lyrics
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

-- SETLISTS
DROP POLICY IF EXISTS "setlists: leer autenticados" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir autenticados" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
CREATE POLICY "setlists: leer autenticados" ON public.setlists
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "setlists: escribir autenticados" ON public.setlists
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

-- SETLIST ITEMS
DROP POLICY IF EXISTS "setlist items: leer autenticados" ON public.setlist_items;
DROP POLICY IF EXISTS "setlist items: escribir autenticados" ON public.setlist_items;
DROP POLICY IF EXISTS "setlist items: escribir admin" ON public.setlist_items;
CREATE POLICY "setlist items: leer autenticados" ON public.setlist_items
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

-- PERIODOS DE RESETEO (escritura admin o superadmin)
DROP POLICY IF EXISTS "periodos: leer autenticados" ON public.reset_periods;
DROP POLICY IF EXISTS "periodos: escribir admin" ON public.reset_periods;
CREATE POLICY "periodos: leer autenticados" ON public.reset_periods
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "periodos: escribir admin" ON public.reset_periods
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

-- TOQUES (escritura admin o superadmin)
DROP POLICY IF EXISTS "toques: leer autenticados" ON public.play_events;
DROP POLICY IF EXISTS "toques: escribir admin" ON public.play_events;
CREATE POLICY "toques: leer autenticados" ON public.play_events
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "toques: escribir admin" ON public.play_events
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

-- ROLES: el superadmin gestiona los admins
DROP POLICY IF EXISTS "roles visibles para autenticados" ON public.user_roles;
DROP POLICY IF EXISTS "roles: gestionar admin" ON public.user_roles;
CREATE POLICY "roles visibles para autenticados" ON public.user_roles
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "roles: gestionar superadmin" ON public.user_roles
  FOR ALL TO authenticated USING (private.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'superadmin'::public.app_role));

-- SOLICITUDES DE ADMIN (las decide el superadmin)
DROP POLICY IF EXISTS "solicitudes: ver propias o admin" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: crear la propia" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: gestionar admin" ON public.role_requests;
DROP POLICY IF EXISTS "solicitudes: borrar admin" ON public.role_requests;
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

-- PERFILES: ver el propio aunque esté pendiente; admins gestionan el estado
DROP POLICY IF EXISTS "perfiles visibles para autenticados" ON public.profiles;
CREATE POLICY "perfiles visibles para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (private.is_approved() OR auth.uid() = id);
CREATE POLICY "perfiles: gestionar estado admin" ON public.profiles
  FOR UPDATE TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));
