
ALTER TABLE public.episodes ADD COLUMN visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.series ADD COLUMN visible boolean NOT NULL DEFAULT true;
