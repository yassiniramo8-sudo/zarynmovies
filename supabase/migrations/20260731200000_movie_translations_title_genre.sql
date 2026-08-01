-- Ensure all translatable columns exist (idempotent)
ALTER TABLE public.content_translations
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS genre text[] DEFAULT '{}'::text[];

-- Unique index for per-locale upserts
CREATE UNIQUE INDEX IF NOT EXISTS content_translations_unique_idx
  ON public.content_translations (content_id, content_type, language);

-- Performance indexes
CREATE INDEX IF NOT EXISTS content_translations_content_idx
  ON public.content_translations (content_id, content_type);
CREATE INDEX IF NOT EXISTS content_translations_language_idx
  ON public.content_translations (language);

-- FK enforcement for the polymorphic table: a trigger validates that
-- content_id references the correct table based on content_type.
CREATE OR REPLACE FUNCTION public.enforce_content_translation_fk()
RETURNS trigger AS $$
DECLARE
  ref_table text;
  exists_row boolean;
BEGIN
  ref_table := CASE NEW.content_type
    WHEN 'movie'   THEN 'movies'
    WHEN 'anime'   THEN 'anime'
    WHEN 'article' THEN 'articles'
    WHEN 'series'  THEN 'series'
    ELSE NULL
  END;
  IF ref_table IS NULL THEN
    RAISE EXCEPTION 'Invalid content_type %', NEW.content_type;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', ref_table)
    INTO exists_row USING NEW.content_id;
  IF NOT exists_row THEN
    RAISE EXCEPTION 'content_id % does not exist in %', NEW.content_id, ref_table;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_translations_fk_check ON public.content_translations;
CREATE TRIGGER trg_content_translations_fk_check
  BEFORE INSERT OR UPDATE OF content_id, content_type
  ON public.content_translations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_content_translation_fk();