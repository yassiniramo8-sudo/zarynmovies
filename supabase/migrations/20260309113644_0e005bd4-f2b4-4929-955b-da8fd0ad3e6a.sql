
-- Content views tracking
CREATE TABLE public.content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  user_ip text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_views_content ON public.content_views(content_type, content_id);
CREATE INDEX idx_content_views_created ON public.content_views(created_at);
CREATE INDEX idx_content_views_ip ON public.content_views(user_ip, content_id);

ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views" ON public.content_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view all views" ON public.content_views
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Content downloads tracking
CREATE TABLE public.content_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  download_link text,
  user_ip text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_downloads_content ON public.content_downloads(content_type, content_id);
CREATE INDEX idx_content_downloads_created ON public.content_downloads(created_at);

ALTER TABLE public.content_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert downloads" ON public.content_downloads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view all downloads" ON public.content_downloads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
