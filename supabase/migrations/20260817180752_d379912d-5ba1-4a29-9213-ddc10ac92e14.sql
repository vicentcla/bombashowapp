REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, created_at, status, onboarded_at) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;