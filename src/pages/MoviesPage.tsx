import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentCard } from "@/components/ContentCard";
import { SEOHead } from "@/components/SEOHead";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { Paginator } from "@/components/Paginator";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePagination } from "@/hooks/usePagination";
import { usePaginationConfig } from "@/hooks/usePaginationConfig";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useBatchContentTranslations } from "@/hooks/useBatchContentTranslations";

interface MovieItem {
  id: string;
  title: string;
  poster_url: string | null;
  rating: number | null;
  year: number | null;
  genre: string[] | null;
  description: string | null;
  trending: boolean | null;
  pinned: boolean | null;
  trailer_url: string | null;
}

const MoviesPage = () => {
  const [allItems, setAllItems] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("all");
  const { t } = useLanguage();
  const { config: paginationConfig } = usePaginationConfig();
  const pageSize = paginationConfig.items_per_page;
  const { page, setPage, resetPage } = usePagination(pageSize);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Load ALL metadata (IDs, genres, years, titles) initially for filtering.
  // Only minimal data — we fetch full details per page from this cached list.
  useEffect(() => {
    supabase
      .from("movies")
      .select("id,title,poster_url,rating,year,genre,description,trending,pinned,trailer_url")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAllItems((data as MovieItem[]) || []);
        setLoading(false);
      });
  }, []);

  // Derive unique genres & years
  const allGenres = useMemo(() => [...new Set(allItems.flatMap((m) => m.genre || []))].sort(), [allItems]);
  const allYears = useMemo(
    () => [...new Set(allItems.map((m) => m.year).filter(Boolean))].sort((a, b) => b! - a!),
    [allItems]
  );

  // Client-side filter (search/genre/year)
  const filtered = useMemo(() => {
    return allItems.filter((m) => {
      const matchSearch = m.title.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchGenre = genre === "all" || (m.genre || []).includes(genre);
      const matchYear = year === "all" || m.year?.toString() === year;
      return matchSearch && matchGenre && matchYear;
    });
  }, [allItems, debouncedSearch, genre, year]);

  // Paginate the filtered list
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedItems = filtered.slice(startIdx, startIdx + pageSize);

  // Reset to page 1 when filters change
  const handleGenreChange = useCallback(
    (v: string) => {
      setGenre(v);
      resetPage();
    },
    [resetPage]
  );
  const handleYearChange = useCallback(
    (v: string) => {
      setYear(v);
      resetPage();
    },
    [resetPage]
  );
  const handleSearchChange = useCallback(
    (v: string) => {
      setSearch(v);
      resetPage();
    },
    [resetPage]
  );

  // Translations for visible items
  const visibleIds = useMemo(() => pagedItems.map((m) => m.id), [pagedItems]);
  const { getDescription, getTitle } = useBatchContentTranslations(visibleIds, "movie");

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="container mx-auto min-h-screen px-4 py-8">
      <SEOHead
        title="Movies"
        description="Browse and stream the latest movies on Zaryn Movies. Filter by genre and year."
      />
      <AdvertisementRenderer placement="movies_list" />
      <h1 className="mb-8 font-display text-4xl font-bold text-foreground">{t("movies.title")}</h1>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("movies.search")}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 border-border/50 bg-background/50"
          />
        </div>
        <Select value={genre} onValueChange={handleGenreChange}>
          <SelectTrigger className="w-full sm:w-40 border-border/50">
            <SelectValue placeholder={t("movies.allGenres")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("movies.allGenres")}</SelectItem>
            {allGenres.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={handleYearChange}>
          <SelectTrigger className="w-full sm:w-32 border-border/50">
            <SelectValue placeholder={t("movies.allYears")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("movies.allYears")}</SelectItem>
            {allYears.map((y) => (
              <SelectItem key={y!} value={y!.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pagedItems.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pagedItems.map((item, i) => (
            <ContentCard
              key={item.id}
              index={i}
              item={{
                id: item.id,
                title: getTitle(item.id, item.title),
                poster: item.poster_url || "/placeholder.svg",
                rating: item.rating || 0,
                year: item.year || 0,
                genre: item.genre || [],
                description: getDescription(item.id, item.description),
                type: "movie",
                trending: item.trending || false,
                trailer_url: item.trailer_url,
              }}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-20 text-center text-muted-foreground">{t("movies.noResults")}</p>
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
  );
};

export default MoviesPage;