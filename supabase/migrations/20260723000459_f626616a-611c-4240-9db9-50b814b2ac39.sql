
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.home_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  type text NOT NULL,
  title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_sections TO authenticated;
GRANT ALL ON public.home_sections TO service_role;
ALTER TABLE public.home_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_sections_public_read" ON public.home_sections FOR SELECT USING (true);
CREATE POLICY "home_sections_admin_write" ON public.home_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_home_sections_updated BEFORE UPDATE ON public.home_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.home_section_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.home_sections(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_home_section_items_section ON public.home_section_items(section_id, sort_order);
GRANT SELECT ON public.home_section_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_section_items TO authenticated;
GRANT ALL ON public.home_section_items TO service_role;
ALTER TABLE public.home_section_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_section_items_public_read" ON public.home_section_items FOR SELECT USING (active = true);
CREATE POLICY "home_section_items_admin_write" ON public.home_section_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_home_section_items_updated BEFORE UPDATE ON public.home_section_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.home_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  banner_url text,
  logo_url text,
  theme_color text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_collections TO authenticated;
GRANT ALL ON public.home_collections TO service_role;
ALTER TABLE public.home_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_collections_public_read" ON public.home_collections FOR SELECT USING (active = true);
CREATE POLICY "home_collections_admin_write" ON public.home_collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_home_collections_updated BEFORE UPDATE ON public.home_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.home_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.home_collections(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_home_collection_items_col ON public.home_collection_items(collection_id, sort_order);
GRANT SELECT ON public.home_collection_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_collection_items TO authenticated;
GRANT ALL ON public.home_collection_items TO service_role;
ALTER TABLE public.home_collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_collection_items_public_read" ON public.home_collection_items FOR SELECT USING (true);
CREATE POLICY "home_collection_items_admin_write" ON public.home_collection_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_home_collection_items_updated BEFORE UPDATE ON public.home_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.home_footer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key text NOT NULL,
  label_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  href text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_footer_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_footer_links TO authenticated;
GRANT ALL ON public.home_footer_links TO service_role;
ALTER TABLE public.home_footer_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "home_footer_links_public_read" ON public.home_footer_links FOR SELECT USING (active = true);
CREATE POLICY "home_footer_links_admin_write" ON public.home_footer_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_home_footer_links_updated BEFORE UPDATE ON public.home_footer_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.home_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_section_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_collections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_collection_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_footer_links;

INSERT INTO public.home_sections (key, type, title_i18n, sort_order, settings) VALUES
  ('hero',              'hero',              '{"en":"Featured","ar":"مميز","fr":"À la une","es":"Destacados"}'::jsonb,                 0,   '{"autoSelect":true,"slides":6,"intervalMs":7000,"transitionMs":900,"autoplay":true,"loop":true,"trailerAutoplay":true,"trailerMute":true,"overlayOpacity":0.55,"blur":0,"heightVh":92}'::jsonb),
  ('continue_watching', 'continue_watching', '{"en":"Continue Watching","ar":"متابعة المشاهدة","fr":"Continuer","es":"Continuar viendo"}'::jsonb, 10,  '{"itemCount":20}'::jsonb),
  ('trending',          'trending',          '{"en":"Trending Now","ar":"الأكثر رواجاً","fr":"Tendances","es":"Tendencias"}'::jsonb,    20,  '{"itemCount":20,"weights":{"views":60,"rating":25,"likes":15},"windowDays":7}'::jsonb),
  ('new_releases',      'new_releases',      '{"en":"New Releases","ar":"إصدارات جديدة","fr":"Nouveautés","es":"Nuevos lanzamientos"}'::jsonb, 30, '{"itemCount":20}'::jsonb),
  ('popular_week',      'popular_week',      '{"en":"Popular This Week","ar":"الأكثر شعبية هذا الأسبوع","fr":"Populaire cette semaine","es":"Popular esta semana"}'::jsonb, 40, '{"itemCount":20,"windowDays":7}'::jsonb),
  ('most_viewed_today', 'most_viewed_today', '{"en":"Most Viewed Today","ar":"الأكثر مشاهدة اليوم","fr":"Les plus vus aujourd''hui","es":"Más vistos hoy"}'::jsonb, 50, '{"itemCount":20,"windowDays":1}'::jsonb),
  ('editor_picks',      'editor_picks',      '{"en":"Editor''s Picks","ar":"اختيارات المحرر","fr":"Choix de la rédaction","es":"Elección del editor"}'::jsonb, 60, '{"itemCount":15}'::jsonb),
  ('recently_added',    'recently_added',    '{"en":"Recently Added","ar":"أُضيف مؤخراً","fr":"Récemment ajoutés","es":"Añadidos recientemente"}'::jsonb, 70, '{"itemCount":20}'::jsonb),
  ('ai_recs',           'ai_recs',           '{"en":"Recommended For You","ar":"موصى لك","fr":"Recommandé pour vous","es":"Recomendado para ti"}'::jsonb, 80, '{"itemCount":10,"contentType":"movie"}'::jsonb),
  ('cat_action',        'category',          '{"en":"Action","ar":"أكشن","fr":"Action","es":"Acción"}'::jsonb,                        90,  '{"itemCount":20,"genre":"Action"}'::jsonb),
  ('cat_comedy',        'category',          '{"en":"Comedy","ar":"كوميديا","fr":"Comédie","es":"Comedia"}'::jsonb,                   100, '{"itemCount":20,"genre":"Comedy"}'::jsonb),
  ('cat_drama',         'category',          '{"en":"Drama","ar":"دراما","fr":"Drame","es":"Drama"}'::jsonb,                          110, '{"itemCount":20,"genre":"Drama"}'::jsonb),
  ('cat_scifi',         'category',          '{"en":"Sci-Fi","ar":"خيال علمي","fr":"Sci-Fi","es":"Ciencia ficción"}'::jsonb,          120, '{"itemCount":20,"genre":"Sci-Fi"}'::jsonb),
  ('collections',       'collections',       '{"en":"Featured Collections","ar":"مجموعات مميزة","fr":"Collections","es":"Colecciones"}'::jsonb, 140, '{}'::jsonb),
  ('live_stats',        'live_stats',        '{"en":"Live","ar":"مباشر","fr":"En direct","es":"En vivo"}'::jsonb,                     150, '{}'::jsonb),
  ('vip',               'vip',               '{"en":"VIP Exclusives","ar":"حصريات VIP","fr":"Exclusivités VIP","es":"Exclusivos VIP"}'::jsonb, 160, '{"itemCount":15}'::jsonb),
  ('footer_extras',     'footer_extras',     '{"en":"Explore","ar":"استكشف","fr":"Explorer","es":"Explorar"}'::jsonb,                 170, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
