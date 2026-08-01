-- Private schema (not exposed through the Data API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate every policy against the private helper
DROP POLICY "arreglos: escribir admin" ON public.arrangements;
CREATE POLICY "arreglos: escribir admin" ON public.arrangements FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "calle: escribir admin" ON public.street_songs;
CREATE POLICY "calle: escribir admin" ON public.street_songs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "letras: escribir admin" ON public.lyrics;
CREATE POLICY "letras: escribir admin" ON public.lyrics FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "setlists: escribir admin" ON public.setlists;
CREATE POLICY "setlists: escribir admin" ON public.setlists FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "setlist items: escribir admin" ON public.setlist_items;
CREATE POLICY "setlist items: escribir admin" ON public.setlist_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "periodos: escribir admin" ON public.reset_periods;
CREATE POLICY "periodos: escribir admin" ON public.reset_periods FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "toques: escribir admin" ON public.play_events;
CREATE POLICY "toques: escribir admin" ON public.play_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "roles: gestionar admin" ON public.user_roles;
CREATE POLICY "roles: gestionar admin" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "solicitudes: ver propias o admin" ON public.role_requests;
CREATE POLICY "solicitudes: ver propias o admin" ON public.role_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "solicitudes: gestionar admin" ON public.role_requests;
CREATE POLICY "solicitudes: gestionar admin" ON public.role_requests FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY "solicitudes: borrar admin" ON public.role_requests;
CREATE POLICY "solicitudes: borrar admin" ON public.role_requests FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Remove the API-exposed helpers
DROP FUNCTION IF EXISTS public.get_profile_email(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);