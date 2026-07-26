
CREATE TABLE public.news_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL,
  language text NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (news_id, language)
);

ALTER TABLE public.news_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view translations" ON public.news_translations
  FOR SELECT TO public USING (true);

CREATE POLICY "Service can manage translations" ON public.news_translations
  FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX idx_news_translations_news_id ON public.news_translations(news_id);
CREATE INDEX idx_news_translations_language ON public.news_translations(language);
