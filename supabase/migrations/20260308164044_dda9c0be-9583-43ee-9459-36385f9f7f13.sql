
-- Add parent_id for nested replies
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE DEFAULT NULL;

-- Create comment_likes table for likes/dislikes
CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  like_type text NOT NULL CHECK (like_type IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for comment_likes
CREATE POLICY "Anyone can view comment likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can like comments" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own likes" ON public.comment_likes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage comment likes" ON public.comment_likes FOR ALL USING (has_permission(auth.uid(), 'moderate_comments'::app_permission));
