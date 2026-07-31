REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

CREATE POLICY "roles: gestionar admin" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;