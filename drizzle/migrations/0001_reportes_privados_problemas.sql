CREATE TABLE public.reportes_problemas (
 id uuid PRIMARY KEY,
 usuario_id uuid NOT NULL REFERENCES public.profiles(id),
 creado_en timestamptz NOT NULL DEFAULT now(),
 estado text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_revision','resuelto')),
 resumen text NOT NULL CHECK (char_length(resumen) <= 500),
 diagnostico jsonb NOT NULL CHECK (octet_length(diagnostico::text) <= 16000),
 huella text NOT NULL
);
GRANT SELECT ON public.reportes_problemas TO authenticated;
GRANT UPDATE (estado) ON public.reportes_problemas TO authenticated;
GRANT ALL ON public.reportes_problemas TO service_role;
ALTER TABLE public.reportes_problemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver reportes propios o administrar" ON public.reportes_problemas FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR (private.is_approved() AND private.has_admin_power(auth.uid())));
CREATE POLICY "Administradores gestionan reportes" ON public.reportes_problemas FOR UPDATE TO authenticated USING (private.is_approved() AND private.has_admin_power(auth.uid())) WITH CHECK (private.is_approved() AND private.has_admin_power(auth.uid()));
CREATE INDEX reportes_problemas_fecha ON public.reportes_problemas (creado_en DESC);
CREATE INDEX reportes_problemas_usuario_fecha ON public.reportes_problemas (usuario_id, creado_en DESC);
CREATE OR REPLACE FUNCTION public.sanear_texto_reporte(valor text, limite integer DEFAULT 500) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $fn$
DECLARE resultado text := coalesce(valor, '');
BEGIN
 resultado := regexp_replace(resultado, 'https?://[^[:space:]"<>]+', '[URL omitida]', 'gi');
 resultado := regexp_replace(resultado, '(authorization|bearer|password|contrase[nñ]a|token|api[_ -]?key|secret|clave)[[:space:]"'':=]+[^[:space:],;]+', '[secreto omitido]', 'gi');
 resultado := regexp_replace(resultado, '(eyJ[A-Za-z0-9_.-]+|sb_(secret|publishable)_[A-Za-z0-9_-]+|AIza[A-Za-z0-9_-]+)', '[secreto omitido]', 'g');
 resultado := regexp_replace(resultado, '[A-Za-z0-9_./+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[correo omitido]', 'g');
 resultado := regexp_replace(resultado, '[A-Za-z0-9_+/.=-]{40,}', '[dato omitido]', 'g');
 RETURN left(resultado, least(greatest(limite, 0), 2000));
END;
$fn$;
REVOKE ALL ON FUNCTION public.sanear_texto_reporte(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanear_texto_reporte(text, integer) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.enviar_reporte_problema(reporte_id uuid, datos jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE uid uuid := auth.uid(); limpio jsonb := '{}'::jsonb; eventos jsonb := '[]'::jsonb; campo text; evento jsonb; resumen_limpio text;
BEGIN
 IF uid IS NULL OR NOT private.is_approved() THEN RAISE EXCEPTION 'Acceso no autorizado' USING ERRCODE = '42501'; END IF;
 IF reporte_id IS NULL OR datos IS NULL OR jsonb_typeof(datos) <> 'object' OR octet_length(datos::text) > 16000 THEN RAISE EXCEPTION 'Diagnóstico inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
 IF EXISTS (SELECT 1 FROM public.reportes_problemas WHERE id = reporte_id AND usuario_id = uid) THEN RETURN reporte_id; END IF;
 IF (SELECT count(*) FROM public.reportes_problemas WHERE usuario_id = uid AND creado_en > now() - interval '1 hour') >= 5 THEN RAISE EXCEPTION 'Límite de reportes: inténtalo más tarde' USING ERRCODE = 'P0001'; END IF;
 FOREACH campo IN ARRAY ARRAY['fecha','version','build','dominio','entorno','sistema','navegador','modo','pantalla','accion','conexion','codigo','mensaje','correlacion','carpeta_id','setlist_id','cancion_id','archivo_id'] LOOP
  IF jsonb_typeof(datos -> campo) = 'string' THEN limpio := limpio || jsonb_build_object(campo, public.sanear_texto_reporte(datos ->> campo, CASE WHEN campo = 'mensaje' THEN 500 ELSE 160 END)); END IF;
 END LOOP;
 IF jsonb_typeof(datos -> 'eventos') = 'array' THEN
  FOR evento IN SELECT value FROM jsonb_array_elements(datos -> 'eventos') LIMIT 12 LOOP
   IF jsonb_typeof(evento) = 'object' THEN eventos := eventos || jsonb_build_array(jsonb_build_object('fecha',public.sanear_texto_reporte(evento ->> 'fecha',40),'tipo',public.sanear_texto_reporte(evento ->> 'tipo',40),'pantalla',public.sanear_texto_reporte(evento ->> 'pantalla',160),'codigo',public.sanear_texto_reporte(evento ->> 'codigo',80),'mensaje',public.sanear_texto_reporte(evento ->> 'mensaje',300))); END IF;
  END LOOP;
 END IF;
 limpio := limpio || jsonb_build_object('eventos', eventos);
 resumen_limpio := coalesce(nullif(limpio ->> 'mensaje',''), 'Problema comunicado por un miembro');
 INSERT INTO public.reportes_problemas(id,usuario_id,resumen,diagnostico,huella) VALUES (reporte_id,uid,resumen_limpio,limpio,md5(coalesce(limpio ->> 'pantalla','') || coalesce(limpio ->> 'codigo','') || resumen_limpio));
 RETURN reporte_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.enviar_reporte_problema(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_reporte_problema(uuid,jsonb) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reportes_problemas;