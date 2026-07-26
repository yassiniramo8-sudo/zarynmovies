
-- Anime groups table
CREATE TABLE public.anime_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.anime_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view anime groups" ON public.anime_groups FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage anime groups" ON public.anime_groups FOR ALL TO authenticated USING (has_permission(auth.uid(), 'manage_anime'::app_permission));

-- Add group_id to anime table
ALTER TABLE public.anime ADD COLUMN group_id UUID REFERENCES public.anime_groups(id) ON DELETE SET NULL;
ALTER TABLE public.anime ADD COLUMN episode_number INTEGER;

-- Comment moderation settings in site_settings (data inserts will be separate)
-- AI moderation log table
CREATE TABLE public.ai_moderation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'flagged',
  reason TEXT,
  confidence NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view moderation logs" ON public.ai_moderation_log FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- AI chat logs table
CREATE TABLE public.ai_chat_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage chat logs" ON public.ai_chat_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
