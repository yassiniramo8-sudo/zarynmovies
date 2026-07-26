ALTER TABLE public.ad_global_settings
  ADD COLUMN IF NOT EXISTS ad_intensity integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS debug_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.ad_global_settings
  DROP CONSTRAINT IF EXISTS ad_global_settings_intensity_range;
ALTER TABLE public.ad_global_settings
  ADD CONSTRAINT ad_global_settings_intensity_range
  CHECK (ad_intensity BETWEEN 0 AND 100);

-- Ensure at least one settings row exists
INSERT INTO public.ad_global_settings (ads_enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.ad_global_settings);