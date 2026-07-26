
-- Add vip_only flag to movies, anime, series tables
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS vip_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS vip_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS vip_only boolean NOT NULL DEFAULT false;
