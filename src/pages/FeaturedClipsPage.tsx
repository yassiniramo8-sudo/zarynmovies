import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { SEOHead } from "@/components/SEOHead";
import { Loader2 } from "lucide-react";

interface Clip {
  id: string;
  title_en: string;
  title_ar: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  teams: string[];
  categories: string[];
  seo_slug: string | null;
  match_date: string | null;
}

const FeaturedClipsPage = () => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const isAr = language === "ar";

  useEffect(() => {
    // Featured clips = published highlights, ordered by most recent
    supabase
      .from("highlights")
      .select("id, title_en, title_ar, youtube_video_id, thumbnail_url, teams, categories, seo_slug, match_date")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setClips((data as any[]) || []);
        setLoading(false);
      });
  }, []);

  const getTitle = (c: Clip) => isAr && c.title_ar ? c.title_ar : c.title_en;
  const getThumb = (c: Clip) => c.thumbnail_url || (c.youtube_video_id ? `https://img.youtube.com/vi/${c.youtube_video_id}/hqdefault.jpg` : "/placeholder.svg");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEOHead title={isAr ? "مقاطع مميزة - ZarynMovies" : "Featured Clips - ZarynMovies"} description="Top curated football clips and highlights." />
      <div className="container mx-auto min-h-screen px-4 py-8" dir={isAr ? "rtl" : "ltr"}>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/news"><ArrowLeft className="mr-1 h-4 w-4" />{isAr ? "العودة للأخبار" : "Back to News"}</Link>
        </Button>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">
          {isAr ? "مقاطع مميزة" : "Featured Clips"}
        </h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clips.map((c) => (
            <Link
              key={c.id}
              to={`/news/summaries/${c.seo_slug || c.id}`}
              className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <div className="relative aspect-video overflow-hidden">
                <img src={getThumb(c)} alt={getTitle(c)} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
                    <Play className="h-5 w-5" />
                  </div>
                </div>
                {c.categories?.[0] && (
                  <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground text-xs">{c.categories[0]}</Badge>
                )}
              </div>
              <div className="p-3 space-y-1">
                <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{getTitle(c)}</h3>
                {c.teams?.length > 0 && <p className="text-xs text-muted-foreground">{c.teams.join(" vs ")}</p>}
              </div>
            </Link>
          ))}
        </div>

        {clips.length === 0 && (
          <p className="py-20 text-center text-muted-foreground">{isAr ? "لا توجد مقاطع بعد." : "No featured clips yet."}</p>
        )}
      </div>
    </>
  );
};

export default FeaturedClipsPage;
