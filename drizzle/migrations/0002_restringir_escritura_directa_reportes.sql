REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.reportes_problemas FROM authenticated;
REVOKE ALL ON public.reportes_problemas FROM anon;
REVOKE UPDATE ON public.reportes_problemas FROM authenticated;
GRANT UPDATE (estado) ON public.reportes_problemas TO authenticated;