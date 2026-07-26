import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, Calendar, ExternalLink, ArrowLeft, Globe, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNewsTranslations } from "@/hooks/useNewsTranslations";
import { SEOHead } from "@/components/SEOHead";


interface NewsItem {
  id: string;
  title: string;
  title_ar: string | null;
  excerpt: string | null;
  excerpt_ar: string | null;
  content: string | null;
  content_ar: string | null;
  image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 30;

const NEWS_LANG_OPTIONS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const SportsNewsPage = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const { language, setLanguage } = useLanguage();
  const { lang: urlLang } = useParams<{ lang?: string }>();
  const [activeSearch, setActiveSearch] = useState("");
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (urlLang && ["ar", "en", "fr", "es"].includes(urlLang) && urlLang !== language) {
      setLanguage(urlLang as any);
    }
  }, [urlLang]);

  const newsIds = useMemo(() => items.map(i => i.id), [items]);
  const { getField, newsLang } = useNewsTranslations(newsIds);
  const isRtl = newsLang === "ar";
  const dateLocale = newsLang === "fr" ? "fr-FR" : newsLang === "es" ? "es-ES" : "en-US";

  const fetchNews = useCallback(async (offset: number, append = false, searchTerm = "") => {
    if (append) setLoadingMore(true); else setLoading(true);

    let query = supabase
      .from("sports_news")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,title_ar.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%`);
    }

    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data } = await query;
    const rawItems = (data as any[]) || [];

    // Deduplicate
    if (!append) {
      seenIds.current = new Set<string>();
    }
    const deduped = rawItems.filter(item => {
      if (seenIds.current.has(item.id)) return false;
      seenIds.current.add(item.id);
      return true;
    });

    if (append) {
      setItems(prev => [...prev, ...deduped]);
    } else {
      setItems(deduped);
    }
    setHasMore(rawItems.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  // Re-fetch when active search changes
  useEffect(() => {
    fetchNews(0, false, activeSearch);
  }, [activeSearch]);

  const handleSearch = () => {
    setActiveSearch(search);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const loadMore = () => {
    fetchNews(items.length, true, activeSearch);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEOHead
        title={newsLang === "ar" ? "أخبار رياضية - ZarynMovies" : newsLang === "fr" ? "Actualités sportives - ZarynMovies" : newsLang === "es" ? "Noticias deportivas - ZarynMovies" : "Sports News - ZarynMovies"}
        description="Latest sports news and football updates."
      />
      <div className="container mx-auto min-h-screen px-4 py-8" dir={isRtl ? "rtl" : "ltr"}>
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/${newsLang}/news`}><ArrowLeft className="mr-1 h-4 w-4" />{newsLang === "ar" ? "العودة للأخبار" : newsLang === "fr" ? "Retour" : newsLang === "es" ? "Volver" : "Back to News"}</Link>
          </Button>
          <div className="flex items-center gap-1">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {NEWS_LANG_OPTIONS.map((opt) => (
              <Link key={opt.code} to={`/${opt.code}/news/sports`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs transition-colors ${newsLang === opt.code ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                <span>{opt.flag}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-3xl font-bold text-foreground">
            {newsLang === "ar" ? "أخبار رياضية حية" : newsLang === "fr" ? "Actualités sportives en direct" : newsLang === "es" ? "Noticias deportivas en vivo" : "Live Sports News"}
          </h1>
          <div className="flex w-full max-w-xs gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={newsLang === "ar" ? "ابحث..." : newsLang === "fr" ? "Rechercher..." : newsLang === "es" ? "Buscar..." : "Search news..."} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown} className="pl-9" />
            </div>
            <Button onClick={handleSearch} size="sm" className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <div key={n.id} className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg">
              {n.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img src={n.image_url} alt={getField(n, "title")} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{getField(n, "title")}</h3>
                {getField(n, "excerpt") && <p className="text-sm text-muted-foreground line-clamp-3">{getField(n, "excerpt")}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  {n.source_name && <Badge variant="secondary" className="text-xs">{n.source_name}</Badge>}
                  {n.category && <Badge variant="outline" className="text-xs">{n.category}</Badge>}
                  {n.published_at && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(n.published_at).toLocaleDateString(dateLocale)}</span>
                  )}
                </div>
                {n.source_url && (
                  <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> {newsLang === "ar" ? "المصدر" : "Source"}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center py-8">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="min-w-[200px]">
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {newsLang === "ar" ? "تحميل المزيد" : newsLang === "fr" ? "Charger plus" : newsLang === "es" ? "Cargar más" : "Load More"}
            </Button>
          </div>
        )}

        {items.length === 0 && (
          <p className="py-20 text-center text-muted-foreground">{newsLang === "ar" ? "لا توجد أخبار بعد." : newsLang === "fr" ? "Aucun article." : newsLang === "es" ? "Sin noticias." : "No news articles yet."}</p>
        )}
      </div>
    </>
  );
};

export default SportsNewsPage;
