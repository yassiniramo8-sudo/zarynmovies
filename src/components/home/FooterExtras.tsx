import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

interface Row { id: string; group_key: string; label_i18n: Record<string, string>; href: string; }

export function FooterExtras({ titleI18n }: { titleI18n: Record<string, string> }) {
  const { language } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("home_footer_links").select("*").eq("active", true).order("sort_order", { ascending: true });
      setRows((data as Row[]) || []);
    })();
  }, []);

  if (!rows.length) return null;
  const grouped = rows.reduce<Record<string, Row[]>>((acc, r) => { (acc[r.group_key] ||= []).push(r); return acc; }, {});
  const title = titleI18n[language] || titleI18n.en || "Explore";
  const groupLabel: Record<string, string> = {
    tags: "Trending Tags", searches: "Popular Searches", genres: "Genres",
    collections: "Collections", news: "Latest News", social: "Social",
    apps: "Apps", help: "Help Center", legal: "Legal",
  };

  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur">
      <h2 className="mb-5 font-display text-2xl font-bold text-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Object.entries(grouped).map(([g, list]) => (
          <div key={g}>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary/80">{groupLabel[g] || g}</div>
            <ul className="space-y-2">
              {list.map((l) => (
                <li key={l.id}>
                  <Link to={l.href} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {l.label_i18n[language] || l.label_i18n.en || l.href}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
