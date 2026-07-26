
-- Polls table for football polls & voting
CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  question_ar TEXT,
  poll_type TEXT NOT NULL DEFAULT 'single_choice',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Poll votes table
CREATE TABLE public.poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Sports news table
CREATE TABLE public.sports_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT,
  content TEXT,
  content_ar TEXT,
  excerpt TEXT,
  excerpt_ar TEXT,
  image_url TEXT,
  video_url TEXT,
  source_url TEXT,
  source_name TEXT,
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'draft',
  ai_generated BOOLEAN DEFAULT false,
  created_by UUID,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_news ENABLE ROW LEVEL SECURITY;

-- Polls RLS
CREATE POLICY "Anyone can view active polls" ON public.polls FOR SELECT TO public USING (status = 'active');
CREATE POLICY "Admins can manage polls" ON public.polls FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Poll votes RLS
CREATE POLICY "Anyone can view votes" ON public.poll_votes FOR SELECT TO public USING (true);
CREATE POLICY "Auth users can vote" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own vote" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Sports news RLS
CREATE POLICY "Anyone can view published news" ON public.sports_news FOR SELECT TO public USING (status = 'published');
CREATE POLICY "Admins can manage news" ON public.sports_news FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_news;
