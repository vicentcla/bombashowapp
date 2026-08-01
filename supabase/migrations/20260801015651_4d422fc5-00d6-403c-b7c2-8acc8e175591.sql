-- 1) Column-level privacy for profiles.email
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM anon;

GRANT SELECT (id, display_name, created_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Own email / admin email access through a dedicated restricted view
CREATE OR REPLACE VIEW public.profiles_private
WITH (security_invoker = true)
AS
SELECT p.id, p.display_name, p.email, p.created_at
FROM public.profiles p
WHERE p.id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role);

GRANT SELECT ON public.profiles_private TO authenticated;
GRANT ALL ON public.profiles_private TO service_role;

-- The view needs full-column read on the base table for the rows it exposes;
-- security_invoker views still check column privileges, so expose email only
-- via an owner/admin-scoped security definer function instead.
DROP VIEW public.profiles_private;

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
    AND (auth.uid() = p.id OR public.has_role(auth.uid(), 'admin'::public.app_role))
$$;

REVOKE ALL ON FUNCTION public.get_profile_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated, service_role;

-- 2) Lock down internal SECURITY DEFINER functions from direct API execution
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;