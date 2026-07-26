import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, Tag, Loader2, Globe, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNewsTranslations } from "@/hooks/useNewsTranslations";
import { SEOHead } from "@/components/SEOHead";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { toast } from "sonner";

const NEWS_LANG_OPTIONS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const NewsDetailPage = () => {
  const { id, lang: urlLang } = useParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (urlLang && ["ar", "en", "fr", "es"].includes(urlLang) && urlLang !== language) {
      setLanguage(urlLang as any);
    }
  }, [urlLang]);

  const newsIds = useMemo(() => (item ? [item.id] : []), [item?.id]);
  const { getField, newsLang } = useNewsTranslations(newsIds);
  const isRtl = newsLang === "ar";
  const dateLocale = newsLang === "ar" ? "ar-EG" : newsLang === "fr" ? "fr-FR" : newsLang === "es" ? "es-ES" : "en-US";

  useEffect(() => {
    if (!id) return;
    supabase
      .from("sports_news")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .single()
      .then(({ data }) => {
        setItem(data);
        setLoading(false);
      });
  }, [id]);

  const handleTranslate = useCallback(async () => {
    if (!id) return;
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-news", {
        body: { newsIds: [id] },
      });
      if (error) throw error;
      toast.success(
        newsLang === "ar" ? `تمت الترجمة بنجاح (${data?.translated || 0} ترجمة)` :
        newsLang === "fr" ? `Traduit avec succès (${data?.translated || 0} traductions)` :
        newsLang === "es" ? `Traducido con éxito (${data?.translated || 0} traducciones)` :
        `Translated successfully (${data?.translated || 0} translations)`
      );
      // Reload page to show new translations
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }, [id, newsLang]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!item) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Article not found</div>;

  const title = getField(item, "title");
  const content = getField(item, "content");
  const excerpt = getField(item, "excerpt");

  const backLabels: Record<string, string> = { en: "Back to News", ar: "العودة للأخبار", fr: "Retour aux actualités", es: "Volver a noticias" };
  const sourceLabels: Record<string, string> = { en: "Original Source", ar: "المصدر الأصلي", fr: "Source originale", es: "Fuente original" };
  const translateLabels: Record<string, string> = { en: "Translate", ar: "ترجمة", fr: "Traduire", es: "Traducir" };

  return (
    <>
      <SEOHead
        title={`${title} - ZarynMovies`}
        description={excerpt || title}
        url={`${window.location.origin}/${newsLang}/news/${id}`}
      />
      <article className="container mx-auto min-h-screen max-w-4xl px-4 py-8" dir={isRtl ? "rtl" : "ltr"}>
        <AdvertisementRenderer placement="inside_article" />
        <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/${newsLang}/news`}><ArrowLeft className="mr-1 h-4 w-4" />{backLabels[newsLang] || backLabels.en}</Link>
          </Button>

          <div className="flex items-center gap-2">
            {/* Translate button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranslate}
              disabled={translating}
              className="gap-1"
            >
              {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
              {translateLabels[newsLang] || translateLabels.en}
            </Button>

            {/* Language switcher */}
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {NEWS_LANG_OPTIONS.map((opt) => (
                <Link
                  key={opt.code}
                  to={`/${opt.code}/news/${id}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    newsLang === opt.code
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span>{opt.flag}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {item.category && <Badge>{item.category}</Badge>}
          {item.published_at && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(item.published_at).toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
            </span>
          )}
          {item.source_name && <Badge variant="secondary">{item.source_name}</Badge>}
        </div>

        <h1 className="mb-4 font-display text-3xl font-bold text-foreground md:text-4xl">{title}</h1>
        <div className="mb-6">
          <SocialShareButtons title={title} description={excerpt || undefined} />
        </div>

        {item.image_url && (
          <div className="mb-8 overflow-hidden rounded-xl">
            <img src={item.image_url} alt={title} className="w-full object-cover" />
          </div>
        )}

        {item.video_url && (
          <div className="mb-8 aspect-video overflow-hidden rounded-xl">
            <iframe
              src={item.video_url.includes("youtube.com/watch") ? item.video_url.replace("watch?v=", "embed/") : item.video_url}
              className="h-full w-full"
              title={title}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope; web-share; display-capture; xr-spatial-tracking"
              sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
              allowFullScreen
              referrerPolicy="no-referrer"
              loading="eager"
            />
          </div>
        )}

        {content && (
          <div className={`prose prose-lg max-w-none dark:prose-invert ${isRtl ? "arabic-content" : ""}`}>
            {content.split("\n").map((p: string, i: number) => p.trim() ? <p key={i}>{p}</p> : null)}
          </div>
        )}

        {item.tags?.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {item.tags.map((tag: string) => <Badge key={tag} variant="outline">{tag}</Badge>)}
          </div>
        )}

        {item.source_url && (
          <div className="mt-6">
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" /> {sourceLabels[newsLang] || sourceLabels.en}
            </a>
          </div>
        )}

        {/* Related News */}
        <RelatedNews currentItem={item} newsLang={newsLang} dateLocale={dateLocale} />
      </article>
    </>
  );
};

/* ---------- Related News Component ---------- */
const RelatedNews = ({ currentItem, newsLang, dateLocale }: { currentItem: any; newsLang: string; dateLocale: string }) => {
  const [related, setRelated] = useState<any[]>([]);

  useEffect(() => {
    if (!currentItem) return;
    const fetchRelated = async () => {
      let results: any[] = [];

      // First try: match by category
      if (currentItem.category) {
        const { data } = await supabase
          .from("sports_news")
          .select("id, title, title_ar, image_url, category, published_at, excerpt, excerpt_ar")
          .eq("status", "published")
          .neq("id", currentItem.id)
          .eq("category", currentItem.category)
          .order("published_at", { ascending: false })
          .limit(6);
        results = data || [];
      }

      // Fallback: latest news
      if (results.length === 0) {
        const { data } = await supabase
          .from("sports_news")
          .select("id, title, title_ar, image_url, category, published_at, excerpt, excerpt_ar")
          .eq("status", "published")
          .neq("id", currentItem.id)
          .order("published_at", { ascending: false })
          .limit(6);
        results = data || [];
      }

      setRelated(results);
    };
    fetchRelated();
  }, [currentItem?.id, currentItem?.category]);

  if (related.length === 0) return null;

  const relatedLabels: Record<string, string> = { en: "Related News", ar: "أخبار ذات صلة", fr: "Articles connexes", es: "Noticias relacionadas" };

  return (
    <div className="mt-12 border-t border-border pt-8">
      <h2 className="mb-6 text-2xl font-bold text-foreground">{relatedLabels[newsLang] || relatedLabels.en}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((n) => {
          const rTitle = newsLang === "ar" && n.title_ar ? n.title_ar : n.title;
          return (
            <Link key={n.id} to={`/${newsLang}/news/${n.id}`} className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg">
              {n.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img src={n.image_url} alt={rTitle} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="p-3 space-y-1">
                <h3 className="font-semibold text-foreground line-clamp-2 text-sm group-hover:text-primary transition-colors">{rTitle}</h3>
                <div className="flex items-center gap-2">
                  {n.category && <Badge variant="outline" className="text-xs">{n.category}</Badge>}
                  {n.published_at && (
                    <span className="text-xs text-muted-foreground">{new Date(n.published_at).toLocaleDateString(dateLocale)}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default NewsDetailPage;
