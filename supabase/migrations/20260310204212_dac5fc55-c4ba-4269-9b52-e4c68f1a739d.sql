
-- Legal pages table for editable content per language
CREATE TABLE public.legal_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL, -- e.g. 'privacy_policy', 'terms_of_service', 'about_us', 'contact_us', 'dmca'
  language text NOT NULL DEFAULT 'ar',
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(page_key, language, version)
);

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can view legal pages
CREATE POLICY "Anyone can view legal pages" ON public.legal_pages
  FOR SELECT TO public USING (true);

-- Admins can manage legal pages
CREATE POLICY "Admins can manage legal pages" ON public.legal_pages
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );

-- User notification preferences table
CREATE TABLE public.user_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  notifications_paused boolean NOT NULL DEFAULT false,
  pause_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

-- Users can view own settings
CREATE POLICY "Users can view own notification settings" ON public.user_notification_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can update own settings
CREATE POLICY "Users can update own notification settings" ON public.user_notification_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can insert own settings
CREATE POLICY "Users can insert own notification settings" ON public.user_notification_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Admins can manage all notification settings
CREATE POLICY "Admins can manage notification settings" ON public.user_notification_settings
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );
