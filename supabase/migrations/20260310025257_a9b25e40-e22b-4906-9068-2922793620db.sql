-- Create highlights table
CREATE TABLE public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en text NOT NULL,
  title_ar text,
  description_en text,
  description_ar text,
  teams text[] DEFAULT '{}'::text[],
  match_date date,
  youtube_video_id text,
  thumbnail_url text,
  categories text[] DEFAULT '{}'::text[],
  tags text[] DEFAULT '{}'::text[],
  seo_title text,
  seo_description text,
  seo_keywords text,
  seo_slug text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  source text DEFAULT 'manual',
  source_channel text,
  ai_generated boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published highlights"
  ON public.highlights FOR SELECT TO public
  USING (status = 'published');

CREATE POLICY "Admins can manage highlights"
  ON public.highlights FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.highlights;