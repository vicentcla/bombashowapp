-- Constructor de mensajes de bolo para WhatsApp
CREATE TABLE IF NOT EXISTS public.bolo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  day text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  maps_url text NOT NULL DEFAULT '',
  attendees text[] NOT NULL DEFAULT '{}',
  clothing text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT 'generico',
  data jsonb NOT NULL DEFAULT '{}',
  message text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolo_messages TO authenticated;
GRANT ALL ON public.bolo_messages TO service_role;
ALTER TABLE public.bolo_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bolo: leer autenticados" ON public.bolo_messages;
CREATE POLICY "bolo: leer autenticados" ON public.bolo_messages
  FOR SELECT TO authenticated USING (private.is_approved());
DROP POLICY IF EXISTS "bolo: escribir autenticados" ON public.bolo_messages;
CREATE POLICY "bolo: escribir autenticados" ON public.bolo_messages
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE INDEX IF NOT EXISTS bolo_messages_updated_at_idx ON public.bolo_messages (updated_at DESC);

ALTER TABLE public.bolo_messages ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'generico';
ALTER TABLE public.bolo_messages ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';