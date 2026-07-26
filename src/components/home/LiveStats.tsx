import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Film, Tv, Sparkles, Users, Eye, Crown, Heart, MessageCircle, Star } from "lucide-react";

interface Stat { label: string; value: number; icon: any; }

function Counter({ target }: { target: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now(); const dur = 1400;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span>{n.toLocaleString("en-US")}</span>;
}

export function LiveStats({ titleI18n }: { titleI18n: Record<string, string> }) {
  const { language } = useLanguage();
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    (async () => {
      const [movies, series, animeC, users, views, vips, likes, comments, ratings] = await Promise.all([
        supabase.from("movies").select("id", { count: "exact", head: true }),
        supabase.from("series").select("id", { count: "exact", head: true }),
        supabase.from("anime").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("content_views").select("id", { count: "exact", head: true }),
        (supabase as any).from("user_subscriptions").select("id", { count: "exact", head: true }).gt("expires_at", new Date().toISOString()),
        supabase.from("likes").select("id", { count: "exact", head: true }),
        supabase.from("comments").select("id", { count: "exact", head: true }),
        supabase.from("user_ratings").select("id", { count: "exact", head: true }),
      ]);
      setStats([
        { label: "Movies", value: movies.count || 0, icon: Film },
        { label: "Series", value: series.count || 0, icon: Tv },
        { label: "Anime", value: animeC.count || 0, icon: Sparkles },
        { label: "Users", value: users.count || 0, icon: Users },
        { label: "Views", value: views.count || 0, icon: Eye },
        { label: "VIP", value: vips.count || 0, icon: Crown },
        { label: "Likes", value: likes.count || 0, icon: Heart },
        { label: "Comments", value: comments.count || 0, icon: MessageCircle },
        { label: "Ratings", value: ratings.count || 0, icon: Star },
      ]);
    })();
  }, []);

  const title = titleI18n[language] || titleI18n.en || "Live";

  return (
    <section className="rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 via-card/50 to-card/20 p-6 backdrop-blur sm:p-8">
      <h2 className="mb-6 font-display text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-background/40 p-4 text-center transition hover:border-primary/40 hover:bg-primary/5"
          >
            <s.icon className="h-6 w-6 text-primary transition group-hover:scale-110" />
            <div className="font-display text-xl font-bold text-foreground sm:text-2xl">
              <Counter target={s.value} />
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
