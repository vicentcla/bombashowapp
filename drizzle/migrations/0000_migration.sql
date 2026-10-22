CREATE TABLE public.score_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id text NOT NULL,
  arrangement_id uuid NOT NULL REFERENCES public.arrangements(id) ON DELETE CASCADE,
  file_id text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (folder_id, arrangement_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_links TO authenticated;
GRANT ALL ON public.score_links TO service_role;
ALTER TABLE public.score_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score_links read" ON public.score_links FOR SELECT TO authenticated USING (private.is_approved());
CREATE POLICY "score_links insert" ON public.score_links FOR INSERT TO authenticated WITH CHECK (private.is_approved());
CREATE POLICY "score_links update" ON public.score_links FOR UPDATE TO authenticated USING (private.is_approved()) WITH CHECK (private.is_approved());
CREATE POLICY "score_links delete" ON public.score_links FOR DELETE TO authenticated USING (private.is_approved());