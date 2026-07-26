
ALTER TABLE public.articles ADD COLUMN category text DEFAULT NULL;
ALTER TABLE public.articles ADD COLUMN tags text[] DEFAULT '{}'::text[];
ALTER TABLE public.articles ADD COLUMN featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN status text NOT NULL DEFAULT 'published';
ALTER TABLE public.articles ADD COLUMN published_at timestamp with time zone DEFAULT now();
