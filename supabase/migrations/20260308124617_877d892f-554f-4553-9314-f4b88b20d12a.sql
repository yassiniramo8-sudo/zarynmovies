
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT 'false',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

-- Only super admins can modify
CREATE POLICY "Super admins can manage site settings"
  ON public.site_settings FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default anti-adblock setting (enabled by default)
INSERT INTO public.site_settings (key, value) VALUES ('anti_adblock_enabled', 'true');
