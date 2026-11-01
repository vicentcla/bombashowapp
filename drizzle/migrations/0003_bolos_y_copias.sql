CREATE TABLE public.bolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  fecha date,
  setlist_ids uuid[] NOT NULL DEFAULT '{}',
  played_item_ids uuid[] NOT NULL DEFAULT '{}',
  saved_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolos TO authenticated;
GRANT ALL ON public.bolos TO service_role;
ALTER TABLE public.bolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aprobados ven bolos" ON public.bolos FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "Aprobados crean bolos" ON public.bolos FOR INSERT TO authenticated WITH CHECK (private.is_approved());
CREATE POLICY "Aprobados editan bolos" ON public.bolos FOR UPDATE TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());
CREATE POLICY "Admin borra bolos" ON public.bolos FOR DELETE TO authenticated USING (private.has_admin_power(auth.uid()));

CREATE TABLE private.master_secret (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.master_secret FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.get_master_password() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_superadmin() THEN RAISE EXCEPTION 'Solo superadmin'; END IF;
  RETURN (SELECT secret FROM private.master_secret WHERE id = 1);
END $$;

CREATE OR REPLACE FUNCTION public.set_master_password(nueva text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_superadmin() THEN RAISE EXCEPTION 'Solo superadmin'; END IF;
  IF char_length(coalesce(nueva,'')) < 4 THEN RAISE EXCEPTION 'Mínimo 4 caracteres'; END IF;
  INSERT INTO private.master_secret (id, secret, updated_at) VALUES (1, nueva, now())
  ON CONFLICT (id) DO UPDATE SET secret = excluded.secret, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.export_backup() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_superadmin() THEN RAISE EXCEPTION 'Solo superadmin'; END IF;
  RETURN jsonb_build_object(
    'app', 'la-bomba-show', 'version', 1, 'creado', now(),
    'arrangements', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.arrangements t), '[]'),
    'street_songs', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.street_songs t), '[]'),
    'reset_periods', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.reset_periods t), '[]'),
    'setlists', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.setlists t), '[]'),
    'setlist_items', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.setlist_items t), '[]'),
    'lyrics', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.lyrics t), '[]'),
    'play_events', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.play_events t), '[]'),
    'score_links', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.score_links t), '[]'),
    'bolos', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.bolos t), '[]')
  );
END $$;

CREATE OR REPLACE FUNCTION public.restore_backup(clave text, datos jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NOT private.is_superadmin() THEN RAISE EXCEPTION 'Solo superadmin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.master_secret WHERE id = 1 AND secret = clave) THEN
    RAISE EXCEPTION 'Contraseña maestra incorrecta';
  END IF;
  IF datos->>'app' IS DISTINCT FROM 'la-bomba-show' THEN RAISE EXCEPTION 'Archivo no válido'; END IF;
  DELETE FROM public.play_events WHERE true;
  DELETE FROM public.score_links WHERE true;
  DELETE FROM public.lyrics WHERE true;
  DELETE FROM public.setlist_items WHERE true;
  DELETE FROM public.bolos WHERE true;
  DELETE FROM public.setlists WHERE true;
  DELETE FROM public.reset_periods WHERE true;
  DELETE FROM public.arrangements WHERE true;
  DELETE FROM public.street_songs WHERE true;
  INSERT INTO public.arrangements SELECT * FROM jsonb_populate_recordset(NULL::public.arrangements, coalesce(datos->'arrangements','[]'));
  INSERT INTO public.street_songs SELECT * FROM jsonb_populate_recordset(NULL::public.street_songs, coalesce(datos->'street_songs','[]'));
  INSERT INTO public.reset_periods SELECT * FROM jsonb_populate_recordset(NULL::public.reset_periods, coalesce(datos->'reset_periods','[]'));
  INSERT INTO public.setlists SELECT * FROM jsonb_populate_recordset(NULL::public.setlists, coalesce(datos->'setlists','[]'));
  INSERT INTO public.setlist_items SELECT * FROM jsonb_populate_recordset(NULL::public.setlist_items, coalesce(datos->'setlist_items','[]'));
  INSERT INTO public.lyrics SELECT * FROM jsonb_populate_recordset(NULL::public.lyrics, coalesce(datos->'lyrics','[]'));
  INSERT INTO public.play_events SELECT * FROM jsonb_populate_recordset(NULL::public.play_events, coalesce(datos->'play_events','[]'));
  INSERT INTO public.score_links SELECT * FROM jsonb_populate_recordset(NULL::public.score_links, coalesce(datos->'score_links','[]'));
  INSERT INTO public.bolos SELECT * FROM jsonb_populate_recordset(NULL::public.bolos, coalesce(datos->'bolos','[]'));
END $$;

REVOKE ALL ON FUNCTION public.get_master_password() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_master_password(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.export_backup() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_backup(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_master_password() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_master_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_backup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_backup(text, jsonb) TO authenticated;