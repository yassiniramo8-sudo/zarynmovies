
CREATE TABLE public.sitemap_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  url_type text NOT NULL DEFAULT 'static',
  content_id uuid,
  content_type text,
  title text,
  priority numeric NOT NULL DEFAULT 0.5,
  changefreq text NOT NULL DEFAULT 'weekly',
  active boolean NOT NULL DEFAULT true,
  last_modified timestamptz NOT NULL DEFAULT now(),
  language text DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(url)
);

ALTER TABLE public.sitemap_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sitemap urls" ON public.sitemap_urls
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Admins can manage sitemap urls" ON public.sitemap_urls
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
