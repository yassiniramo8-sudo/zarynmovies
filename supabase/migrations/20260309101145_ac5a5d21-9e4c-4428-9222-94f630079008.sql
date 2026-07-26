
CREATE TABLE public.advertisements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  ad_type text NOT NULL DEFAULT 'banner',
  placement text NOT NULL DEFAULT 'inline',
  content_html text,
  image_url text,
  link_url text,
  target_pages text[] DEFAULT '{}'::text[],
  target_content_id uuid,
  target_content_type text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  hide_for_vip boolean NOT NULL DEFAULT true,
  language text DEFAULT 'all',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active ads" ON public.advertisements
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage ads" ON public.advertisements
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
