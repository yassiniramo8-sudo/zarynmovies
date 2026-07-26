
CREATE TABLE public.page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'system',
  label text NOT NULL,
  icon text,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','maintenance','admin_only')),
  show_in_nav boolean NOT NULL DEFAULT false,
  show_in_footer boolean NOT NULL DEFAULT false,
  show_in_sidebar boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  redirect_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.page_settings TO authenticated;
GRANT ALL ON public.page_settings TO service_role;

ALTER TABLE public.page_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_settings readable by everyone"
  ON public.page_settings FOR SELECT
  USING (true);

CREATE POLICY "page_settings manageable by admins"
  ON public.page_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_page_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_page_settings
  BEFORE UPDATE ON public.page_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_page_settings();

ALTER PUBLICATION supabase_realtime ADD TABLE public.page_settings;
ALTER TABLE public.page_settings REPLICA IDENTITY FULL;

-- Seed the known routes. show_in_nav mirrors the current Navbar.
INSERT INTO public.page_settings (route_key, category, label, icon, show_in_nav, show_in_footer, sort_order, is_system) VALUES
  ('/',              'main', 'Home',           'Home',       true,  false, 10, true),
  ('/movies',        'main', 'Movies',         'Film',       true,  true,  20, true),
  ('/anime',         'main', 'Anime',          'Tv',         true,  true,  30, true),
  ('/series',        'main', 'Series',         'Tv',         true,  true,  40, true),
  ('/summaries',     'main', 'Summaries',      'FileVideo',  true,  false, 50, true),
  ('/news',          'main', 'News',           'Newspaper',  true,  true,  60, true),
  ('/articles',      'main', 'Articles',       'FileText',   true,  true,  70, true),
  ('/subscribe',     'vip',  'VIP',            'Crown',      true,  false, 80, true),
  ('/contact',       'main', 'Support Center', 'LifeBuoy',   true,  true,  90, true),
  ('/home',          'main', 'Classic Home',   'LayoutGrid', false, false, 95, true),
  ('/entertainment', 'main', 'Entertainment AI','Sparkles',  false, false, 96, true),
  ('/news/polls',    'main', 'Polls',          'Vote',       false, false, 97, true),
  ('/news/clips',    'main', 'Featured Clips', 'Film',       false, false, 98, true),
  ('/auth',            'user', 'Sign In',           'LogIn',   false, false, 10, true),
  ('/profile',         'user', 'Profile',           'User',    false, false, 20, true),
  ('/reset-password',  'user', 'Reset Password',    'KeyRound',false, false, 30, true),
  ('/subscribe',       'vip',  'VIP Subscribe',     'Crown',   false, false, 10, true)
ON CONFLICT (route_key) DO NOTHING;

INSERT INTO public.page_settings (route_key, category, label, icon, show_in_nav, show_in_footer, sort_order, is_system) VALUES
  ('/privacy-policy',  'system', 'Privacy Policy',    'ShieldCheck', false, true, 10, true),
  ('/terms-of-service','system', 'Terms of Service',  'FileText',    false, true, 20, true),
  ('/about-us',        'system', 'About Us',          'Info',        false, true, 30, true),
  ('/contact-us',      'system', 'Contact Us',        'Mail',        false, true, 40, true),
  ('/dmca',            'system', 'DMCA',              'Scale',       false, true, 50, true)
ON CONFLICT (route_key) DO NOTHING;
