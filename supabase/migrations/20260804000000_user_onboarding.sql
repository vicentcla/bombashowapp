-- =============================================================
-- Onboarding del usuario aprobado: primera vez tras la aprobación
-- debe completar su usuario (nombre, instrumento, contraseña).
-- =============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Exponer la nueva columna al cliente (los grants de SELECT son por columna)
GRANT SELECT (id, display_name, created_at, status, onboarded_at) ON public.profiles TO authenticated;

-- Los usuarios ya existentes y aprobados con nombre completaron su perfil:
-- se marcan como onboarded para no repetir el alta
UPDATE public.profiles
SET onboarded_at = COALESCE(created_at, now())
WHERE status = 'approved'
  AND display_name IS NOT NULL
  AND onboarded_at IS NULL;
