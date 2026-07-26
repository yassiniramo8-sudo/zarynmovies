import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, Search, Play, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paginator } from "@/components/Paginator";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { SEOHead } from "@/components/SEOHead";
import { usePagination } from "@/hooks/usePagination";
import { usePaginationConfig } from "@/hooks/usePaginationConfig";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

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
  seo_slug: string | null;
  status: string;
  summary_type: string;
  created_at: string;
}

const HighlightsPage = () => {
  const { type } = useParams<{ type?: string }>();
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { config: paginationConfig } = usePaginationConfig();
  const pageSize = paginationConfig.items_per_page;
  const { page, setPage, resetPage } = usePagination(pageSize);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    let query = supabase
      .from("highlights")
      .select("*")
      .eq("status", "published")
      .order("match_date", { ascending: false, nullsFirst: false });

    if (type) {
      query = query.eq("summary_type", type);
    }

    query.then(({ data }) => {
      setItems((data as unknown as Highlight[]) || []);
      setLoading(false);
    });
  }, [type]);

  const [allTypes, setAllTypes] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from("highlights")
      .select("summary_type")
      .eq("status", "published")
      .then(({ data }) => {
        const types = new Set((data || []).map((d: any) => d.summary_type));
        setAllTypes(Array.from(types).sort());
      });
  }, []);

  const filtered = useMemo(() => {
    return items.filter((h) => {
      const title = isAr ? h.title_ar || h.title_en : h.title_en;
      const teams = h.teams?.join(" ") || "";
      return (title + teams).toLowerCase().includes(debouncedSearch.toLowerCase());
    });
  }, [items, debouncedSearch, isAr]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

  const handleSearchChange = useCallback(
    (v: string) => { setSearch(v); resetPage(); },
    [resetPage]
  );

  const getTitle = (h: Highlight) => (isAr && h.title_ar ? h.title_ar : h.title_en);
  const getThumb = (h: Highlight) =>
    h.thumbnail_url || (h.youtube_video_id ? `https://img.youtube.com/vi/${h.youtube_video_id}/hqdefault.jpg` : "/placeholder.svg");

  const pageTitle = type
    ? `${type.charAt(0).toUpperCase() + type.slice(1)} Summaries`
    : (isAr ? "جميع الملخصات" : "All Summaries");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEOHead title={`${pageTitle} - ZarynMovies`} description={`Watch the latest ${pageTitle.toLowerCase()} on ZarynMovies.`} />
      <div className="container mx-auto min-h-screen px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-4xl font-bold text-foreground">{pageTitle}</h1>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={isAr ? "ابحث..." : "Search summaries..."} value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
          </div>
        </div>

        {allTypes.length > 1 && (
          <Tabs value={type || "all"} className="mb-6">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all" asChild>
                <Link to="/summaries">{isAr ? "الكل" : "All"}</Link>
              </TabsTrigger>
              {allTypes.map((t) => (
                <TabsTrigger key={t} value={t} asChild>
                  <Link to={`/summaries/${t}`} className="capitalize">{t}</Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {pagedItems.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pagedItems.map((h) => (
              <Link
                key={h.id}
                to={`/summaries/${h.summary_type}/${h.seo_slug || h.id}`}
                className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="relative aspect-video overflow-hidden">
                  <img src={getThumb(h)} alt={getTitle(h)} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground">
                      <Play className="h-6 w-6" />
                    </div>
                  </div>
                  <Badge className="absolute top-3 left-3 bg-primary/90 text-primary-foreground capitalize">{h.summary_type}</Badge>
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{getTitle(h)}</h3>
                  {h.teams?.length > 0 && <p className="text-sm text-muted-foreground">{h.teams.join(" vs ")}</p>}
                  {h.match_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(h.match_date).toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="py-20 text-center text-muted-foreground">{isAr ? "لا توجد ملخصات بعد." : "No summaries found."}</p>
        )}

        <Paginator
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          showFirstLast={paginationConfig.show_first_last}
          showPrevNext={paginationConfig.show_prev_next}
          showPageNumbers={paginationConfig.show_page_numbers}
        />
      </div>
    </>
  );
};

export default HighlightsPage;