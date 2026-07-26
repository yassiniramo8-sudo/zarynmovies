
-- Add gallery_images column to movies and anime
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS gallery_images text[] DEFAULT '{}';
ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS gallery_images text[] DEFAULT '{}';

-- Create user_ratings table
CREATE TABLE public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id uuid NOT NULL,
  content_type text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, content_type)
);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON public.user_ratings
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Auth users can rate" ON public.user_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rating" ON public.user_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rating" ON public.user_ratings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Function to compute average rating for a content item
CREATE OR REPLACE FUNCTION public.get_average_rating(_content_id uuid, _content_type text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
  FROM public.user_ratings
  WHERE content_id = _content_id AND content_type = _content_type
$$;
