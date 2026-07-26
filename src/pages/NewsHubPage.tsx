import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Calendar, Loader2, Newspaper, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNewsTranslations } from "@/hooks/useNewsTranslations";
import { SEOHead } from "@/components/SEOHead";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";


interface NewsItem {
  id: string;
  title: string;
  title_ar: string | null;
  excerpt: string | null;
  excerpt_ar: string | null;
  content: string | null;
  content_ar: string | null;
  image_url: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
}

const PAGE_SIZE = 30;

const NEWS_LANG_OPTIONS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const COLUMNS = "id, title, title_ar, excerpt, excerpt_ar, content, content_ar, image_url, category, tags, published_at";

const NewsHubPage = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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

  const fetchNews = useCallback(async (offset: number, append = false, searchTerm = "", category: string | null = null) => {
    if (append) setLoadingMore(true); else setLoading(true);

    let query = supabase
      .from("sports_news")
      .select(COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    // Server-side search: match against title or title_ar
    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,title_ar.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,excerpt.ilike.%${searchTerm}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data } = await query;
    const rawItems = (data as NewsItem[]) || [];

    // Deduplicate by id
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

  // Re-fetch when active search or category changes
  useEffect(() => {
    fetchNews(0, false, activeSearch, selectedCategory);
  }, [activeSearch, selectedCategory]);

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
    fetchNews(items.length, true, activeSearch, selectedCategory);
  };

  const categories = useMemo(() => {
    return Array.from(new Set(items.map(n => n.category).filter(Boolean)));
  }, [items]);

  const seoTitles: Record<string, string> = {
    en: "News - ZarynMovies", ar: "الأخبار - ZarynMovies", fr: "Actualités - ZarynMovies", es: "Noticias - ZarynMovies",
  };
  const seoDescs: Record<string, string> = {
    en: "Latest news and articles across all categories.", ar: "أحدث الأخبار والمقالات من جميع الفئات",
    fr: "Dernières nouvelles et articles dans toutes les catégories.", es: "Últimas noticias y artículos en todas las categorías.",
  };
  const searchPlaceholders: Record<string, string> = {
    en: "Search news...", ar: "ابحث في الأخبار...", fr: "Rechercher...", es: "Buscar noticias...",
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEOHead title={seoTitles[newsLang] || seoTitles.en} description={seoDescs[newsLang] || seoDescs.en} url={`${window.location.origin}/${newsLang}/news`} />
      <div className="container mx-auto min-h-screen px-4 py-8" dir={isRtl ? "rtl" : "ltr"}>
        <AdvertisementRenderer placement="news_list" />
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <Newspaper className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{seoTitles[newsLang]?.split(" - ")[0] || "News"}</h1>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            {NEWS_LANG_OPTIONS.map((opt) => (
              <Link key={opt.code} to={`/${opt.code}/news`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors ${newsLang === opt.code ? "bg-primary text-primary-foreground font-medium" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                <span>{opt.flag}</span><span>{opt.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full max-w-sm gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={searchPlaceholders[newsLang] || searchPlaceholders.en} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearchKeyDown} className="pl-9" />
            </div>
            <Button onClick={handleSearch} size="sm" className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={selectedCategory === null ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedCategory(null)}>
              {newsLang === "ar" ? "الكل" : newsLang === "fr" ? "Tous" : newsLang === "es" ? "Todos" : "All"}
            </Badge>
            {categories.map((cat) => (
              <Badge key={cat} variant={selectedCategory === cat ? "default" : "outline"} className="cursor-pointer" onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}>
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {items.length > 0 && (
          <Link to={`/${newsLang}/news/${items[0].id}`} className="group mb-8 block overflow-hidden rounded-2xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-xl">
            <div className="grid md:grid-cols-2">
              {items[0].image_url && (
                <div className="aspect-video overflow-hidden md:aspect-auto md:min-h-[300px]">
                  <img src={items[0].image_url} alt={getField(items[0], "title")} loading="eager" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="flex flex-col justify-center p-6 md:p-8">
                <div className="mb-3 flex items-center gap-2">
                  {items[0].category && <Badge>{items[0].category}</Badge>}
                  {items[0].published_at && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(items[0].published_at).toLocaleDateString(dateLocale)}</span>
                  )}
                </div>
                <h2 className="mb-2 text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{getField(items[0], "title")}</h2>
                {getField(items[0], "excerpt") && <p className="text-muted-foreground line-clamp-3">{getField(items[0], "excerpt")}</p>}
              </div>
            </div>
          </Link>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(1).map((n) => (
            <Link key={n.id} to={`/${newsLang}/news/${n.id}`} className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg">
              {n.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img src={n.image_url} alt={getField(n, "title")} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{getField(n, "title")}</h3>
                {getField(n, "excerpt") && <p className="text-sm text-muted-foreground line-clamp-3">{getField(n, "excerpt")}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  {n.category && <Badge variant="outline" className="text-xs">{n.category}</Badge>}
                  {n.published_at && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(n.published_at).toLocaleDateString(dateLocale)}</span>
                  )}
                </div>
              </div>
            </Link>
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
          <div className="py-20 text-center">
            <Newspaper className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{newsLang === "ar" ? "لا توجد أخبار بعد." : newsLang === "fr" ? "Aucun article pour l'instant." : newsLang === "es" ? "No hay noticias aún." : "No news articles yet."}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default NewsHubPage;
