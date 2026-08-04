ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
UPDATE public.profiles SET onboarded_at = created_at WHERE onboarded_at IS NULL AND status = 'approved';