-- Constructor de mensajes de bolo para WhatsApp
CREATE TABLE public.bolo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  day text NOT NULL DEFAULT '',
  time text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  maps_url text NOT NULL DEFAULT '',
  attendees text[] NOT NULL DEFAULT '{}',
  clothing text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolo_messages TO authenticated;
GRANT ALL ON public.bolo_messages TO service_role;
ALTER TABLE public.bolo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolo: leer autenticados" ON public.bolo_messages
  FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "bolo: escribir autenticados" ON public.bolo_messages
  FOR ALL TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());

CREATE INDEX bolo_messages_updated_at_idx ON public.bolo_messages (updated_at DESC);
