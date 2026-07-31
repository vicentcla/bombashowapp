-- Orden manual
ALTER TABLE public.arrangements ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.street_songs ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH o AS (SELECT id, row_number() OVER (ORDER BY title) AS rn FROM public.arrangements)
UPDATE public.arrangements a SET sort_order = o.rn FROM o WHERE o.id = a.id;
WITH o AS (SELECT id, row_number() OVER (ORDER BY title) AS rn FROM public.street_songs)
UPDATE public.street_songs s SET sort_order = o.rn FROM o WHERE o.id = s.id;

-- Solicitudes para ser administrador
CREATE TABLE IF NOT EXISTS public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solicitudes: ver propias o admin" ON public.role_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "solicitudes: crear la propia" ON public.role_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "solicitudes: gestionar admin" ON public.role_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "solicitudes: borrar admin" ON public.role_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $set_updated_at$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$set_updated_at$;

CREATE TRIGGER update_role_requests_updated_at BEFORE UPDATE ON public.role_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Los nuevos usuarios entran siempre como miembros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'miembro'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;