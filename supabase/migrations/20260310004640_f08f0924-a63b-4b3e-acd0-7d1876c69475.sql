
-- Enable realtime for key admin content tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.movies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anime;
ALTER PUBLICATION supabase_realtime ADD TABLE public.series;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.advertisements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Create AI site monitoring logs table
CREATE TABLE public.ai_site_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text,
  auto_fixed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_site_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage site logs" ON public.ai_site_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert site logs" ON public.ai_site_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Insert default AI settings
INSERT INTO public.site_settings (key, value) VALUES
  ('ai_auto_fix_enabled', 'false'),
  ('ai_monitoring_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
