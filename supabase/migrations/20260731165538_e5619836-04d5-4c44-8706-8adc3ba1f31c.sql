-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'miembro');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

CREATE POLICY "perfiles visibles para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cada uno edita su perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "cada uno crea su perfil" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "roles visibles para autenticados" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- Alta automática de perfil + rol (primer usuario = admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'miembro'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ARREGLOS
CREATE TABLE public.arrangements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arrangements TO authenticated;
GRANT ALL ON public.arrangements TO service_role;
ALTER TABLE public.arrangements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arreglos: leer autenticados" ON public.arrangements FOR SELECT TO authenticated USING (true);
CREATE POLICY "arreglos: escribir admin" ON public.arrangements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CANCIONES DE CALLE
CREATE TABLE public.street_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.street_songs TO authenticated;
GRANT ALL ON public.street_songs TO service_role;
ALTER TABLE public.street_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calle: leer autenticados" ON public.street_songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "calle: escribir admin" ON public.street_songs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- LETRAS
CREATE TABLE public.lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('calle', 'arreglo')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  plain_text text NOT NULL DEFAULT '',
  arrangement_id uuid REFERENCES public.arrangements(id) ON DELETE SET NULL,
  street_song_id uuid REFERENCES public.street_songs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lyrics TO authenticated;
GRANT ALL ON public.lyrics TO service_role;
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "letras: leer autenticados" ON public.lyrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "letras: escribir admin" ON public.lyrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SETLISTS
CREATE TABLE public.setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setlists TO authenticated;
GRANT ALL ON public.setlists TO service_role;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "setlists: leer autenticados" ON public.setlists FOR SELECT TO authenticated USING (true);
CREATE POLICY "setlists: escribir admin" ON public.setlists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.setlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  arrangement_id uuid NOT NULL REFERENCES public.arrangements(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setlist_items TO authenticated;
GRANT ALL ON public.setlist_items TO service_role;
ALTER TABLE public.setlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "setlist items: leer autenticados" ON public.setlist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "setlist items: escribir admin" ON public.setlist_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PERIODOS DE RESETEO
CREATE TABLE public.reset_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('calle', 'arreglo')),
  label text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reset_periods TO authenticated;
GRANT ALL ON public.reset_periods TO service_role;
ALTER TABLE public.reset_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periodos: leer autenticados" ON public.reset_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "periodos: escribir admin" ON public.reset_periods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- REGISTRO DE TOQUES
CREATE TABLE public.play_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('calle', 'arreglo')),
  arrangement_id uuid REFERENCES public.arrangements(id) ON DELETE CASCADE,
  street_song_id uuid REFERENCES public.street_songs(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.reset_periods(id) ON DELETE SET NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CHECK (
    (scope = 'calle' AND street_song_id IS NOT NULL) OR
    (scope = 'arreglo' AND arrangement_id IS NOT NULL)
  )
);
CREATE INDEX play_events_scope_played_at_idx ON public.play_events (scope, played_at DESC);
CREATE INDEX play_events_period_idx ON public.play_events (period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_events TO authenticated;
GRANT ALL ON public.play_events TO service_role;
ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "toques: leer autenticados" ON public.play_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "toques: escribir admin" ON public.play_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Periodos iniciales
INSERT INTO public.reset_periods (scope, label) VALUES ('calle', 'Periodo inicial'), ('arreglo', 'Periodo inicial');