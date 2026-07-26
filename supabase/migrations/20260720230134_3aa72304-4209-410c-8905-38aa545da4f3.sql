
-- 1) Extend advertisements table
ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_targeting text[] NOT NULL DEFAULT ARRAY['all']::text[],
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS max_impressions integer,
  ADD COLUMN IF NOT EXISTS max_clicks integer,
  ADD COLUMN IF NOT EXISTS impressions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ab_group text;

CREATE INDEX IF NOT EXISTS advertisements_active_placement_idx
  ON public.advertisements (active, placement, priority DESC, sort_order ASC);

-- 2) Global ad settings (single-row table, key/value)
CREATE TABLE IF NOT EXISTS public.ad_global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ads_enabled boolean NOT NULL DEFAULT true,
  google_ads_enabled boolean NOT NULL DEFAULT true,
  affiliate_ads_enabled boolean NOT NULL DEFAULT true,
  emergency_hide boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_global_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ad_global_settings TO authenticated;
GRANT ALL ON public.ad_global_settings TO service_role;

ALTER TABLE public.ad_global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read ad global settings" ON public.ad_global_settings;
CREATE POLICY "Anyone can read ad global settings"
  ON public.ad_global_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage ad global settings" ON public.ad_global_settings;
CREATE POLICY "Admins manage ad global settings"
  ON public.ad_global_settings FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- Seed single row
INSERT INTO public.ad_global_settings (ads_enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.ad_global_settings);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_global_settings;

-- 3) Counter increment functions (security definer so guests can log stats)
CREATE OR REPLACE FUNCTION public.increment_ad_impression(_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.advertisements
    SET impressions_count = impressions_count + 1
    WHERE id = _ad_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_ad_click(_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.advertisements
    SET clicks_count = clicks_count + 1
    WHERE id = _ad_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ad_impression(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ad_click(uuid) TO anon, authenticated;
