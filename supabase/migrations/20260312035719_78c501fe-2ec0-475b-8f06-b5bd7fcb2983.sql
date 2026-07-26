
-- Enable pg_cron and pg_net extensions for scheduled auto-translation
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add unique constraint on news_translations for upsert if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_translations_unique_idx'
  ) THEN
    ALTER TABLE public.news_translations ADD CONSTRAINT news_translations_unique_idx UNIQUE (news_id, language);
  END IF;
END $$;
