-- Plantillas de bolo: fiestas y bolo suelto (estructura JSON) + selector
ALTER TABLE public.bolo_messages ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'generico';
ALTER TABLE public.bolo_messages ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';
