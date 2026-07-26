
CREATE TABLE public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  source_type text NOT NULL DEFAULT 'rss',
  category text DEFAULT 'general',
  language text DEFAULT 'ar',
  active boolean NOT NULL DEFAULT true,
  last_fetched_at timestamp with time zone,
  fetch_interval_hours integer NOT NULL DEFAULT 24,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage news sources" ON public.news_sources
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active sources" ON public.news_sources
  FOR SELECT TO public
  USING (active = true);
