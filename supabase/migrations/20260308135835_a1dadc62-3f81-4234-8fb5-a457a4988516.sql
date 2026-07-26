
CREATE TABLE public.user_ad_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  ads_enabled boolean NOT NULL DEFAULT true,
  adblock_enforcement boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ad_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user ad settings"
  ON public.user_ad_settings
  FOR ALL
  USING (has_permission(auth.uid(), 'manage_users'::app_permission));

CREATE POLICY "Users can view own ad settings"
  ON public.user_ad_settings
  FOR SELECT
  USING (auth.uid() = user_id);
