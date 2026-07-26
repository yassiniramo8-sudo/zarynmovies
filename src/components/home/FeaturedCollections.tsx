import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface Collection {
  id: string; slug: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  banner_url: string | null; logo_url: string | null; theme_color: string | null;
}

export function FeaturedCollections({ titleI18n }: { titleI18n: Record<string, string> }) {
  const { language } = useLanguage();
  const [cols, setCols] = useState<Collection[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("home_collections").select("*").eq("active", true).order("sort_order", { ascending: true });
      setCols((data as Collection[]) || []);
    })();
  }, []);

  if (!cols.length) return null;
  const title = titleI18n[language] || titleI18n.en || "Collections";

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cols.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
          >
            <Link
              to={`/collections/${c.slug}`}
              className="group relative block h-52 overflow-hidden rounded-2xl border border-border/40"
              style={{ background: c.theme_color || undefined }}
            >
              {c.banner_url && (
                <img src={c.banner_url} alt={c.title_i18n[language] || c.slug} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                {c.logo_url ? <img src={c.logo_url} alt="" className="mb-2 h-10 w-auto object-contain" /> : null}
                <h3 className="font-display text-2xl font-bold text-white drop-shadow-md">{c.title_i18n[language] || c.title_i18n.en || c.slug}</h3>
                {(c.description_i18n?.[language] || c.description_i18n?.en) && (
                  <p className="mt-1 line-clamp-2 text-sm text-white/80">{c.description_i18n[language] || c.description_i18n.en}</p>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
