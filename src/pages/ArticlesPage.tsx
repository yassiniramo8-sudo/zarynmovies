import { useState, useEffect, useMemo, useCallback } from "react";
import { Heart, MessageCircle, Search, Star, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useContentCounts } from "@/hooks/useContentCounts";
import { CommentsModal } from "@/components/CommentsModal";
import { SEOHead } from "@/components/SEOHead";
import { Paginator } from "@/components/Paginator";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/usePagination";
import { usePaginationConfig } from "@/hooks/usePaginationConfig";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";

function FeaturedArticle({ article }: { article: any }) {
  const counts = useContentCounts(article.id, "article");

  return (
    <Link to={`/articles/${article.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="aspect-[21/9] overflow-hidden">
          <img src={article.cover_url || "/placeholder.svg"} alt={article.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary/20 text-primary border-primary/30"><Star className="h-3 w-3 mr-1" /> Featured</Badge>
            {article.category && <Badge variant="outline" className="border-border/50">{article.category}</Badge>}
          </div>
          <h2 className="mb-2 font-display text-2xl font-bold text-foreground md:text-3xl">{article.title}</h2>
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2 max-w-2xl">{article.excerpt}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{new Date(article.published_at || article.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {counts.likes}</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {counts.comments}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article }: { article: any }) {
  const counts = useContentCounts(article.id, "article");
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <>
      <div className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <Link to={`/articles/${article.id}`}>
          <div className="aspect-video overflow-hidden">
            <img src={article.cover_url || "/placeholder.svg"} alt={article.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
        </Link>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {article.category && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{article.category}</Badge>}
            {article.tags?.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[10px] border-border/50 text-muted-foreground">{tag}</Badge>
            ))}
          </div>
          <Link to={`/articles/${article.id}`}>
            <h3 className="mb-2 font-display text-lg font-bold text-foreground line-clamp-2 hover:text-primary transition-colors">{article.title}</h3>
          </Link>
          <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{new Date(article.published_at || article.created_at).toLocaleDateString()}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {counts.likes}</span>
              <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1 hover:text-primary transition-colors">
                <MessageCircle className="h-3 w-3" /> {counts.comments}
              </button>
            </div>
          </div>
        </div>
      </div>
      <CommentsModal open={commentsOpen} onOpenChange={setCommentsOpen} contentId={article.id} contentType="article" title={article.title} />
    </>
  );
}

const ArticlesPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const { t } = useLanguage();
  const { config: paginationConfig } = usePaginationConfig();
  const pageSize = paginationConfig.items_per_page;
  const { page, setPage, resetPage } = usePagination(pageSize);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    supabase.from("articles").select("*").eq("status", "published").order("published_at", { ascending: false }).then(({ data }) => {
      setItems(data || []);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((a) => { if (a.category) cats.add(a.category); });
    return Array.from(cats).sort();
  }, [items]);

  const featured = items.filter((a) => a.featured);
  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (debouncedSearch && !a.title.toLowerCase().includes(debouncedSearch.toLowerCase()) && !(a.excerpt || "").toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (selectedCategory && a.category !== selectedCategory) return false;
      return true;
    });
  }, [items, debouncedSearch, selectedCategory]);

  const nonFeatured = useMemo(() => filtered.filter((a) => !a.featured), [filtered]);

  // Paginate non-featured articles
  const totalPages = Math.max(1, Math.ceil(nonFeatured.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = nonFeatured.slice(startIdx, startIdx + pageSize);

  const handleSearchChange = useCallback(
    (v: string) => { setSearch(v); resetPage(); },
    [resetPage]
  );
  const handleCategoryChange = useCallback(
    (cat: string) => { setSelectedCategory(cat); resetPage(); },
    [resetPage]
  );

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto min-h-screen px-4 py-8">
      <SEOHead title="Articles" description="Read the latest articles, news, and reviews on Zaryn Movies. Stay updated with trending topics." />
      <AdvertisementRenderer placement="articles_list" />
      <h1 className="mb-2 font-display text-4xl font-bold text-foreground">{t("articles.title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("articles.subtitle")}</p>

      {featured.length > 0 && (
        <div className="mb-12 space-y-6">
          {featured.slice(0, 2).map((article) => <FeaturedArticle key={article.id} article={article} />)}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("articles.search")} value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10 border-border/50 bg-background/50" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleCategoryChange("")} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {t("articles.allCategories")}
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => handleCategoryChange(cat)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {pagedItems.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pagedItems.map((article) => <ArticleCard key={article.id} article={article} />)}
        </div>
      )}

      {filtered.length === 0 && <p className="py-20 text-center text-muted-foreground">{t("articles.noResults")}</p>}

      <Paginator
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        showFirstLast={paginationConfig.show_first_last}
        showPrevNext={paginationConfig.show_prev_next}
        showPageNumbers={paginationConfig.show_page_numbers}
      />
    </div>
  );
};

export default ArticlesPage;