import { useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Film, Tv, Sparkles, Star, Calendar, Loader2, ExternalLink, Play, Download, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useQuery } from "@tanstack/react-query";

type ContentItem = {
  source: string;
  source_label?: string;
  content_type: "anime" | "movie" | "series";
  tmdb_id?: number;
  mal_id?: number;
  anilist_id?: number;
  kitsu_id?: string;
  id?: string;
  title: string;
  title_ar?: string;
  overview?: string;
  overview_ar?: string;
  poster_url?: string;
  backdrop_url?: string;
  year?: string;
  rating?: number;
  popularity?: number;
  genres?: any[];
  link?: string;
  source_name?: string;
  tags?: string[];
  release_date?: string;
  published_at?: string;
  episodes?: number;
  status?: string;
};

type EnrichedItem = ContentItem & {
  trailer_url?: string;
  cast?: { name: string; character: string; profile_path: string | null }[];
  gallery_images?: string[];
  runtime?: number;
  tagline?: string;
  seo_title?: string;
  seo_description?: string;
  seo_title_ar?: string;
  seo_description_ar?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  imdb_rating?: string;
  imdb_id?: string;
  awards?: string;
  box_office?: string;
  director?: string;
  writer?: string;
};

const CATEGORY_ICONS = { anime: "🎌", movie: "🎬", series: "📺" };

const SOURCE_COLORS: Record<string, string> = {
  tmdb: "bg-blue-500/10 text-blue-600",
  jikan: "bg-indigo-500/10 text-indigo-600",
  anilist: "bg-cyan-500/10 text-cyan-600",
  kitsu: "bg-orange-500/10 text-orange-600",
  rss: "bg-green-500/10 text-green-600",
  local: "bg-primary/10 text-primary",
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: { all: "All", anime: "Anime", movie: "Movies", series: "TV Series" },
  ar: { all: "الكل", anime: "أنمي", movie: "أفلام", series: "مسلسلات" },
};

export default function EntertainmentAIPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isAr = language === "ar";
  const labels = CATEGORY_LABELS[isAr ? "ar" : "en"];

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [enrichedItem, setEnrichedItem] = useState<EnrichedItem | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["entertainment-ai", debouncedQuery, activeCategory],
    queryFn: async () => {
      const action = debouncedQuery.length >= 2 ? "search" : "browse";
      const { data, error } = await supabase.functions.invoke("entertainment-ai", {
        body: {
          action,
          query: debouncedQuery || undefined,
          category: activeCategory === "all" ? undefined : activeCategory,
          limit: 60,
        },
      });
      if (error) throw error;
      return (data?.items || []) as ContentItem[];
    },
    staleTime: 60000,
  });

  const handleEnrich = useCallback(async (item: ContentItem) => {
    setSelectedItem(item);
    setEnrichedItem(null);
    setImported(false);
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("entertainment-ai", {
        body: {
          action: "enrich",
          tmdb_id: item.tmdb_id || undefined,
          media_type: item.content_type === "movie" ? "movie" : "tv",
          title: item.title,
          content_type: item.content_type,
          overview: item.overview,
          poster_url: item.poster_url,
          backdrop_url: item.backdrop_url,
          year: item.year,
          rating: item.rating,
          genres: item.genres,
          link: item.link,
          source: item.source,
          source_label: item.source_label,
        },
      });
      if (error) throw error;
      setEnrichedItem(data?.item || item);
    } catch {
      toast({ title: "Error", description: "Failed to enrich content", variant: "destructive" });
      setEnrichedItem(item as EnrichedItem);
    } finally {
      setEnriching(false);
    }
  }, [toast]);

  const handleImport = useCallback(async () => {
    if (!enrichedItem) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("entertainment-ai", {
        body: { action: "import_to_library", item: enrichedItem },
      });
      if (error) throw error;
      setImported(true);
      toast({
        title: isAr ? "تمت الإضافة ✅" : "Added to Library ✅",
        description: isAr ? `تم حفظ "${enrichedItem.title}" بنجاح` : `"${enrichedItem.title}" saved to ${data.table}`,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [enrichedItem, toast, isAr]);

  const items = data || [];

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <SEOHead
        title={isAr ? "الترفيه الذكي - أنمي وأفلام ومسلسلات" : "Entertainment AI - Anime, Movies & TV Shows"}
        description={isAr ? "اكتشف أفضل الأنمي والأفلام والمسلسلات من 50+ مصدر عالمي" : "Discover the best anime, movies and TV shows from 50+ global sources"}
      />

      {/* Hero / Search */}
      <div className="relative bg-gradient-to-b from-primary/10 to-background px-4 pt-24 pb-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-bold text-foreground md:text-4xl">
            <Sparkles className="h-7 w-7 text-primary" />
            {isAr ? "الترفيه الذكي" : "Entertainment AI"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isAr ? "ابحث من 50+ مصدر عالمي وعربي — أنمي، أفلام، مسلسلات" : "Search 50+ global & Arabic sources — Anime, Movies, TV Shows"}
          </p>

          <div className="relative mt-6">
            <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAr ? "ابحث عن عنوان..." : "Search for a title..."}
              className="h-12 rounded-xl ps-10 text-base"
            />
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mt-4">
            <TabsList className="mx-auto">
              {["all", "anime", "movie", "series"].map(cat => (
                <TabsTrigger key={cat} value={cat} className="gap-1">
                  {cat !== "all" && <span>{CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS]}</span>}
                  {labels[cat]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {isAr ? "لا توجد نتائج" : "No results found"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item, idx) => (
              <Card
                key={`${item.source}-${item.tmdb_id || item.mal_id || item.anilist_id || item.kitsu_id || item.id || idx}`}
                className="group cursor-pointer overflow-hidden border-border/50 transition-all hover:border-primary/50 hover:shadow-lg"
                onClick={() => handleEnrich(item)}
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <Badge className="absolute top-2 left-2 gap-1 text-xs rtl:left-auto rtl:right-2" variant="secondary">
                    {CATEGORY_ICONS[item.content_type]} {labels[item.content_type]}
                  </Badge>
                  {item.rating && item.rating > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md bg-background/70 px-1.5 py-0.5 text-xs font-semibold text-secondary rtl:left-2 rtl:right-auto">
                      <Star className="h-3 w-3 fill-secondary" />
                      {typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
                    </div>
                  )}
                  {/* Source badge */}
                  <div className={`absolute bottom-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-medium rtl:left-auto rtl:right-2 ${SOURCE_COLORS[item.source] || "bg-muted text-muted-foreground"}`}>
                    {item.source_label || item.source.toUpperCase()}
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
                    {isAr && item.title_ar ? item.title_ar : item.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {item.year && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" /> {item.year}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={open => { if (!open) { setSelectedItem(null); setEnrichedItem(null); setImported(false); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {enriching ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-3 text-muted-foreground">{isAr ? "جارٍ إثراء المحتوى..." : "Enriching content..."}</p>
            </div>
          ) : enrichedItem ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{isAr && enrichedItem.title_ar ? enrichedItem.title_ar : enrichedItem.title}</DialogTitle>
                {enrichedItem.tagline && <p className="text-sm italic text-muted-foreground">{enrichedItem.tagline}</p>}
              </DialogHeader>

              {enrichedItem.backdrop_url && (
                <img src={enrichedItem.backdrop_url} alt="" className="w-full rounded-lg object-cover" style={{ maxHeight: 250 }} />
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{labels[enrichedItem.content_type]}</Badge>
                {enrichedItem.year && <Badge variant="outline"><Calendar className="mr-1 h-3 w-3" />{enrichedItem.year}</Badge>}
                {enrichedItem.rating && enrichedItem.rating > 0 && (
                  <Badge variant="outline" className="text-secondary"><Star className="mr-1 h-3 w-3 fill-secondary" />{enrichedItem.rating}</Badge>
                )}
                {enrichedItem.runtime && <Badge variant="outline">{enrichedItem.runtime} min</Badge>}
                {enrichedItem.number_of_seasons && <Badge variant="outline">{enrichedItem.number_of_seasons} seasons</Badge>}
                {enrichedItem.episodes && <Badge variant="outline">{enrichedItem.episodes} eps</Badge>}
                {enrichedItem.imdb_rating && (
                  <Badge variant="outline" className="text-secondary">IMDb {enrichedItem.imdb_rating}</Badge>
                )}
                {enrichedItem.director && <Badge variant="outline">🎬 {enrichedItem.director}</Badge>}
              </div>

              {/* Genres */}
              {enrichedItem.genres && enrichedItem.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {enrichedItem.genres.map((g: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{typeof g === "string" ? g : g}</Badge>
                  ))}
                </div>
              )}

              {/* Overview */}
              {(enrichedItem.overview || enrichedItem.overview_ar) && (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">{enrichedItem.overview}</p>
                  {enrichedItem.overview_ar && (
                    <p className="text-sm text-muted-foreground" dir="rtl">{enrichedItem.overview_ar}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {enrichedItem.trailer_url && (
                  <a href={enrichedItem.trailer_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <Play className="h-4 w-4" /> {isAr ? "مشاهدة الإعلان" : "Watch Trailer"}
                    </Button>
                  </a>
                )}
                {enrichedItem.source !== "local" && (
                  <Button
                    onClick={handleImport}
                    disabled={importing || imported}
                    className="gap-2"
                    variant={imported ? "secondary" : "default"}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : imported ? <CheckCircle className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {imported ? (isAr ? "تمت الإضافة" : "Added") : (isAr ? "أضف للمكتبة" : "Add to Library")}
                  </Button>
                )}
              </div>

              {/* Cast */}
              {enrichedItem.cast && enrichedItem.cast.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{isAr ? "الممثلون" : "Cast"}</h4>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {enrichedItem.cast.map((c, i) => (
                      <div key={i} className="flex flex-col items-center text-center" style={{ minWidth: 70 }}>
                        {c.profile_path ? (
                          <img src={c.profile_path} alt={c.name} className="h-16 w-16 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                            {c.name[0]}
                          </div>
                        )}
                        <span className="mt-1 text-xs font-medium text-foreground">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">{c.character}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gallery */}
              {enrichedItem.gallery_images && enrichedItem.gallery_images.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{isAr ? "معرض الصور" : "Gallery"}</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {enrichedItem.gallery_images.slice(0, 6).map((img, i) => (
                      <img key={i} src={img} alt="" className="rounded-md object-cover" style={{ height: 100 }} loading="lazy" />
                    ))}
                  </div>
                </div>
              )}

              {/* SEO Preview */}
              {enrichedItem.seo_title && (
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{isAr ? "معاينة SEO" : "SEO Preview"}</p>
                  <p className="text-sm font-semibold text-primary">{enrichedItem.seo_title}</p>
                  <p className="text-xs text-muted-foreground">{enrichedItem.seo_description}</p>
                  {enrichedItem.seo_title_ar && (
                    <div className="mt-2 border-t border-border pt-2" dir="rtl">
                      <p className="text-sm font-semibold text-primary">{enrichedItem.seo_title_ar}</p>
                      <p className="text-xs text-muted-foreground">{enrichedItem.seo_description_ar}</p>
                    </div>
                  )}
                </div>
              )}

              {enrichedItem.link && (
                <a href={enrichedItem.link} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1">
                    <ExternalLink className="h-3 w-3" /> {isAr ? "المصدر" : "Source"}
                  </Button>
                </a>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
