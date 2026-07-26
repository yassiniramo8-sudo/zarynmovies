import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Calendar, Tag, ArrowLeft } from "lucide-react";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { CommentsSection } from "@/components/CommentsSection";
import { SEOHead } from "@/components/SEOHead";
import { Loader2 } from "lucide-react";

interface Highlight {
  id: string;
  title_en: string;
  title_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  teams: string[];
  match_date: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  categories: string[];
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  seo_slug: string | null;
  status: string;
  created_at: string;
}

const HighlightDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<Highlight | null>(null);
  const [related, setRelated] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();
  const isAr = language === "ar";

  useEffect(() => {
    if (!slug) return;

    const fetchHighlight = async () => {
      // Try by slug first, then by id
      let { data } = await supabase
        .from("highlights")
        .select("*")
        .eq("seo_slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (!data) {
        const res = await supabase
          .from("highlights")
          .select("*")
          .eq("id", slug)
          .eq("status", "published")
          .maybeSingle();
        data = res.data;
      }

      setItem(data as unknown as Highlight | null);
      setLoading(false);

      // Fetch related
      if (data) {
        const { data: rel } = await supabase
          .from("highlights")
          .select("*")
          .eq("status", "published")
          .neq("id", (data as any).id)
          .order("match_date", { ascending: false })
          .limit(6);
        setRelated((rel as unknown as Highlight[]) || []);
      }
    };

    fetchHighlight();
  }, [slug]);

  const getTitle = (h: Highlight) => (isAr && h.title_ar ? h.title_ar : h.title_en);
  const getDesc = (h: Highlight) => (isAr && h.description_ar ? h.description_ar : h.description_en);
  const getThumb = (h: Highlight) =>
    h.thumbnail_url || (h.youtube_video_id ? `https://img.youtube.com/vi/${h.youtube_video_id}/hqdefault.jpg` : "/placeholder.svg");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!item) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{isAr ? "لم يتم العثور على الفيديو" : "Highlight not found."}</div>;

  return (
    <>
      <SEOHead
        title={item.seo_title || getTitle(item)}
        description={item.seo_description || getDesc(item) || ""}
        image={getThumb(item)}
      />
      <div className="container mx-auto min-h-screen px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/summaries">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {isAr ? "العودة" : "Back to Summaries"}
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            {item.youtube_video_id ? (
              <div className="aspect-video overflow-hidden rounded-xl border border-border/50">
                <iframe
                  src={`https://www.youtube.com/embed/${item.youtube_video_id}?rel=0`}
                  title={getTitle(item)}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope; web-share; display-capture; xr-spatial-tracking"
                  sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  loading="eager"
                  className="h-full w-full"
                />
              </div>
            ) : (
              <div className="aspect-video overflow-hidden rounded-xl border border-border/50">
                <img src={getThumb(item)} alt={getTitle(item)} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="space-y-3">
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{getTitle(item)}</h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {item.teams?.length > 0 && (
                  <span className="font-medium text-foreground">{item.teams.join(" vs ")}</span>
                )}
                {item.match_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(item.match_date).toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                )}
              </div>

              {item.categories?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.categories.map((c) => (
                    <Badge key={c} variant="secondary">{c}</Badge>
                  ))}
                </div>
              )}

              <SocialShareButtons title={getTitle(item)} description={getDesc(item) || undefined} />

              {getDesc(item) && (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{getDesc(item)}</p>
              )}

              {item.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {item.tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                      <Tag className="h-3 w-3" /> {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="pt-4">
              <CommentsSection contentId={item.id} contentType="highlight" />
            </div>
          </div>

          {/* Related Highlights */}
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {isAr ? "ملخصات أخرى" : "Related Summaries"}
            </h2>
            <div className="space-y-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/summaries/${(r as any).summary_type || "sport"}/${r.seo_slug || r.id}`}
                  className="flex gap-3 rounded-lg border border-border/50 bg-card p-2 transition-colors hover:border-primary/30"
                >
                  <img
                    src={getThumb(r)}
                    alt={getTitle(r)}
                    className="h-20 w-32 rounded-md object-cover flex-shrink-0"
                    loading="lazy"
                  />
                  <div className="flex flex-col justify-center min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{getTitle(r)}</p>
                    {r.teams?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{r.teams.join(" vs ")}</p>
                    )}
                    {r.match_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(r.match_date).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
              {related.length === 0 && (
                <p className="text-sm text-muted-foreground">{isAr ? "لا توجد ملخصات أخرى" : "No related summaries yet."}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HighlightDetailPage;
