-- user_roles: limitar la lectura al propio rol o a administradores
DROP POLICY IF EXISTS "roles visibles para autenticados" ON public.user_roles;
CREATE POLICY "roles: ver el propio o admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_admin_power(auth.uid())
);

-- social_posts: los borradores solo para su autor o administradores
DROP POLICY IF EXISTS "redes: leer autenticados" ON public.social_posts;
CREATE POLICY "redes: leer segun estado"
ON public.social_posts
FOR SELECT
TO authenticated
USING (
  private.is_approved()
  AND (
    status <> 'borrador'
    OR created_by = auth.uid()
    OR private.has_admin_power(auth.uid())
  )
);