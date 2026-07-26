
-- Create series table
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  poster_url text,
  genre text[] DEFAULT '{}'::text[],
  year integer,
  rating numeric DEFAULT 0,
  trailer_url text,
  trending boolean DEFAULT false,
  pinned boolean DEFAULT false,
  gallery_images text[] DEFAULT '{}'::text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create episodes table
CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  episode_number integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  trailer_url text,
  watch_servers jsonb DEFAULT '[]'::jsonb,
  download_servers jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

-- Series RLS policies
CREATE POLICY "Anyone can view series" ON public.series FOR SELECT USING (true);
CREATE POLICY "Admins can manage series" ON public.series FOR ALL USING (has_permission(auth.uid(), 'manage_movies'::app_permission));

-- Episodes RLS policies
CREATE POLICY "Anyone can view episodes" ON public.episodes FOR SELECT USING (true);
CREATE POLICY "Admins can manage episodes" ON public.episodes FOR ALL USING (has_permission(auth.uid(), 'manage_movies'::app_permission));

-- Create index on episodes for series_id lookup
CREATE INDEX idx_episodes_series_id ON public.episodes(series_id);
CREATE INDEX idx_episodes_order ON public.episodes(series_id, episode_number);
