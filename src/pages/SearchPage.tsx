import { useMemo, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Loader2, Star, Film, Tv, Clapperboard, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentCard } from "@/components/ContentCard";
import { SEOHead } from "@/components/SEOHead";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { Paginator } from "@/components/Paginator";
import { useGlobalSearch, type SearchResult } from "@/hooks/useGlobalSearch";
import { usePagination } from "@/hooks/usePagination";
import { usePaginationConfig } from "@/hooks/usePaginationConfig";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Type filter tabs                                                   */
/* ------------------------------------------------------------------ */

const TYPE_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
] as const;

/* ------------------------------------------------------------------ */
/*  SearchPage                                                         */
/* ------------------------------------------------------------------ */

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState("all");
  const { config: paginationConfig } = usePaginationConfig();
  const pageSize = paginationConfig.items_per_page;
  const { page, setPage, resetPage } = usePagination(pageSize);

  const { results: allResults, loading, totalCount } = useGlobalSearch(query);

  // Filter by type
  const filtered = useMemo(() => {
    if (typeFilter === "all") return allResults;
    return allResults.filter((r) => r.type === typeFilter);
  }, [allResults, typeFilter]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

  const handleSearchChange = useCallback(
    (v: string) => {
      setQuery(v);
      setSearchParams(v ? { q: v } : {}, { replace: true });
      resetPage();
    },
    [resetPage, setSearchParams]
  );

  const handleTypeChange = useCallback(
    (v: string) => {
      setTypeFilter(v);
      resetPage();
    },
    [resetPage]
  );

  return (
    <div className="container mx-auto min-h-screen px-4 py-8">
      <SEOHead
        title={query ? `Search: ${query}` : "Search"}
        description="Search across all movies, series, and anime on Zaryn Movies."
      />

      <AdvertisementRenderer placement="search_top" />

      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">Search</h1>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search movies, series, anime..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          autoFocus
          className="h-12 pl-12 pr-4 border-border/50 bg-background/50 text-base rounded-xl"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Type filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleTypeChange(opt.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              typeFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      {query && !loading && (
        <p className="mb-6 text-sm text-muted-foreground">
          {totalCount > 0
            ? `Found ${totalCount} result${totalCount !== 1 ? "s" : ""} for "${query}"`
            : `No results found for "${query}"`}
        </p>
      )}

      {/* Results grid */}
      {pagedItems.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pagedItems.map((item, i) => (
            <ContentCard
              key={`${item.type}-${item.id}`}
              index={i}
              item={{
                id: item.id,
                title: item.title,
                poster: item.poster_url || "/placeholder.svg",
                rating: item.rating || 0,
                year: item.year || 0,
                genre: item.genre || [],
                description: "",
                type: item.type,
              }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {query && !loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="text-lg font-medium text-foreground">No results found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filter to find what you're looking for.
            </p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagedItems.length > 0 && (
        <Paginator
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          showFirstLast={paginationConfig.show_first_last}
          showPrevNext={paginationConfig.show_prev_next}
          showPageNumbers={paginationConfig.show_page_numbers}
        />
      )}

      <AdvertisementRenderer placement="search_bottom" />
    </div>
  );
}