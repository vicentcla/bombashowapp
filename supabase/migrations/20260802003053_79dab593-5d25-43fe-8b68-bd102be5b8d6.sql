ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';

GRANT SELECT (id, display_name, created_at, status) ON public.profiles TO authenticated;

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
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved'
  )
$$;
REVOKE ALL ON FUNCTION private.is_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_approved() TO authenticated, service_role;

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

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'superadmin'::public.app_role
FROM public.profiles p
WHERE (SELECT COUNT(*) FROM public.profiles) = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'superadmin'::public.app_role
  )
LIMIT 1;

CREATE OR REPLACE FUNCTION public.get_profile_email(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

DROP POLICY IF EXISTS "arreglos: leer autenticados" ON public.arrangements;
DROP POLICY IF EXISTS "arreglos: escribir autenticados" ON public.arrangements;
DROP POLICY IF EXISTS "arreglos: escribir admin" ON public.arrangements;
CREATE POLICY "arreglos: leer autenticados" ON public.arrangements
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "arreglos: escribir autenticados" ON public.arrangements
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

DROP POLICY IF EXISTS "calle: leer autenticados" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir autenticados" ON public.street_songs;
DROP POLICY IF EXISTS "calle: escribir admin" ON public.street_songs;
CREATE POLICY "calle: leer autenticados" ON public.street_songs
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "calle: escribir autenticados" ON public.street_songs
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

DROP POLICY IF EXISTS "letras: leer autenticados" ON public.lyrics;
DROP POLICY IF EXISTS "letras: escribir autenticados" ON public.lyrics;
DROP POLICY IF EXISTS "letras: escribir admin" ON public.lyrics;
CREATE POLICY "letras: leer autenticados" ON public.lyrics
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "letras: escribir autenticados" ON public.lyrics
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

DROP POLICY IF EXISTS "setlists: leer autenticados" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir autenticados" ON public.setlists;
DROP POLICY IF EXISTS "setlists: escribir admin" ON public.setlists;
CREATE POLICY "setlists: leer autenticados" ON public.setlists
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "setlists: escribir autenticados" ON public.setlists
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

DROP POLICY IF EXISTS "setlist items: leer autenticados" ON public.setlist_items;
DROP POLICY IF EXISTS "setlist items: escribir autenticados" ON public.setlist_items;
DROP POLICY IF EXISTS "setlist items: escribir admin" ON public.setlist_items;
CREATE POLICY "setlist items: leer autenticados" ON public.setlist_items
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "setlist items: escribir autenticados" ON public.setlist_items
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

DROP POLICY IF EXISTS "periodos: leer autenticados" ON public.reset_periods;
DROP POLICY IF EXISTS "periodos: escribir admin" ON public.reset_periods;
CREATE POLICY "periodos: leer autenticados" ON public.reset_periods
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "periodos: escribir admin" ON public.reset_periods
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

DROP POLICY IF EXISTS "toques: leer autenticados" ON public.play_events;
DROP POLICY IF EXISTS "toques: escribir admin" ON public.play_events;
CREATE POLICY "toques: leer autenticados" ON public.play_events
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "toques: escribir admin" ON public.play_events
  FOR ALL TO authenticated USING (private.has_admin_power(auth.uid()))
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

DROP POLICY IF EXISTS "perfiles visibles para autenticados" ON public.profiles;
DROP POLICY IF EXISTS "perfiles: gestionar estado admin" ON public.profiles;
CREATE POLICY "perfiles visibles para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (private.is_approved() OR auth.uid() = id);
CREATE POLICY "perfiles: gestionar estado admin" ON public.profiles
  FOR UPDATE TO authenticated USING (private.has_admin_power(auth.uid()))
  WITH CHECK (private.has_admin_power(auth.uid()));

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  network text NOT NULL DEFAULT 'instagram' CHECK (network IN ('instagram', 'tiktok', 'whatsapp')),
  status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'en_revision', 'aprobado')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "redes: leer autenticados" ON public.social_posts;
DROP POLICY IF EXISTS "redes: escribir autenticados" ON public.social_posts;
CREATE POLICY "redes: leer autenticados" ON public.social_posts
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "redes: escribir autenticados" ON public.social_posts
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE TABLE IF NOT EXISTS public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_comments TO authenticated;
GRANT ALL ON public.social_comments TO service_role;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comentarios: leer autenticados" ON public.social_comments;
DROP POLICY IF EXISTS "comentarios: escribir autenticados" ON public.social_comments;
CREATE POLICY "comentarios: leer autenticados" ON public.social_comments
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "comentarios: escribir autenticados" ON public.social_comments
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE INDEX IF NOT EXISTS social_posts_updated_at_idx ON public.social_posts (updated_at DESC);
CREATE INDEX IF NOT EXISTS social_comments_post_id_idx ON public.social_comments (post_id);