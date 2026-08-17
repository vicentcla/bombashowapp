CREATE OR REPLACE FUNCTION public.sanitize_lyrics_html(_html text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := coalesce(_html, '');
BEGIN
  -- Elimina bloques peligrosos con su contenido
  result := regexp_replace(result, '<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>.*?<\s*/\s*\1\s*>', '', 'gis');
  result := regexp_replace(result, '<\s*/?\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>', '', 'gis');
  -- Elimina comentarios HTML
  result := regexp_replace(result, '<!--.*?-->', '', 'gs');
  -- Elimina cualquier etiqueta que no esté en la lista permitida
  result := regexp_replace(result, '<\s*/?\s*(?!(b|strong|i|em|u|p|br|div|hr|span)\b)[a-zA-Z0-9-]+\b[^>]*>', '', 'gis');
  -- Elimina todos los atributos de las etiquetas permitidas
  result := regexp_replace(result, '<\s*(b|strong|i|em|u|p|br|div|hr|span)\b[^>]*?(/?)>', '<\1\2>', 'gis');
  result := regexp_replace(result, '<\s*/\s*(b|strong|i|em|u|p|br|div|hr|span)\s*>', '</\1>', 'gis');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_lyrics_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.content := public.sanitize_lyrics_html(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_lyrics_content ON public.lyrics;
CREATE TRIGGER sanitize_lyrics_content
BEFORE INSERT OR UPDATE ON public.lyrics
FOR EACH ROW EXECUTE FUNCTION public.sanitize_lyrics_content();

UPDATE public.lyrics SET content = public.sanitize_lyrics_html(content)
WHERE content IS NOT NULL AND content <> public.sanitize_lyrics_html(content);