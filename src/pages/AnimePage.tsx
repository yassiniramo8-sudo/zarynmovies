import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, ChevronDown, ChevronRight, FolderOpen, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentCard } from "@/components/ContentCard";
import { SEOHead } from "@/components/SEOHead";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { Paginator } from "@/components/Paginator";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePagination } from "@/hooks/usePagination";
import { usePaginationConfig } from "@/hooks/usePaginationConfig";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface AnimeGroup {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  sort_order: number;
}

const AnimePage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [groups, setGroups] = useState<AnimeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { t } = useLanguage();
  const { config: paginationConfig } = usePaginationConfig();
  const pageSize = paginationConfig.items_per_page;
  const { page, setPage, resetPage } = usePagination(pageSize);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    Promise.all([
      supabase.from("anime").select("*").order("episode_number").order("created_at", { ascending: false }),
      supabase.from("anime_groups").select("*").order("sort_order"),
    ]).then(([animeRes, groupsRes]) => {
      setItems(animeRes.data || []);
      setGroups(groupsRes.data || []);
      setExpandedGroups(new Set((groupsRes.data || []).map((g: AnimeGroup) => g.id)));
      setLoading(false);
    });
  }, []);

  const allGenres = useMemo(() => [...new Set(items.flatMap((m) => m.genre || []))].sort(), [items]);
  const allYears = useMemo(
    () => [...new Set(items.map((m) => m.year).filter(Boolean))].sort((a: number, b: number) => b - a),
    [items]
  );

  const applyFilters = (list: any[]) =>
    list.filter((m) => {
      const matchSearch = m.title.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchGenre = genre === "all" || (m.genre || []).includes(genre);
      const matchYear = year === "all" || m.year?.toString() === year;
      return matchSearch && matchGenre && matchYear;
    });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const groupedAnime = useMemo(() => {
    return groups.map((g) => ({
      ...g,
      anime: applyFilters(items.filter((a) => a.group_id === g.id)),
    }));
  }, [groups, items, debouncedSearch, genre, year]);

  const ungrouped = useMemo(() => applyFilters(items.filter((a) => !a.group_id)), [items, debouncedSearch, genre, year]);

  // Paginate ungrouped anime
  const totalPages = Math.max(1, Math.ceil(ungrouped.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedUngrouped = ungrouped.slice(startIdx, startIdx + pageSize);

  const totalFiltered = useMemo(
    () => groupedAnime.reduce((acc, g) => acc + g.anime.length, 0) + ungrouped.length,
    [groupedAnime, ungrouped]
  );

  const handleGenreChange = useCallback(
    (v: string) => { setGenre(v); resetPage(); },
    [resetPage]
  );
  const handleYearChange = useCallback(
    (v: string) => { setYear(v); resetPage(); },
    [resetPage]
  );
  const handleSearchChange = useCallback(
    (v: string) => { setSearch(v); resetPage(); },
    [resetPage]
  );

  const renderCard = (item: any, i: number) => (
    <ContentCard
      key={item.id}
      index={i}
      item={{
        id: item.id,
        title: item.title + (item.episode_number ? ` — Ep. ${item.episode_number}` : ""),
        poster: item.poster_url || "/placeholder.svg",
        rating: item.rating || 0,
        year: item.year || 0,
        genre: item.genre || [],
        description: item.description || "",
        type: "anime",
        trending: item.trending || false,
        trailer_url: item.trailer_url,
      }}
    />
  );

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="container mx-auto min-h-screen px-4 py-8">
      <SEOHead title="Anime" description="Browse and stream anime on Zaryn Movies." />
      <AdvertisementRenderer placement="anime_list" />
      <h1 className="mb-8 font-display text-4xl font-bold text-foreground">{t("anime.title")}</h1>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("anime.search")}
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
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={handleYearChange}>
          <SelectTrigger className="w-full sm:w-32 border-border/50">
            <SelectValue placeholder={t("movies.allYears")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("movies.allYears")}</SelectItem>
            {allYears.map((y: number) => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groupedAnime.map((group) => {
        if (group.anime.length === 0 && (debouncedSearch || genre !== "all" || year !== "all")) return null;
        return (
          <Collapsible
            key={group.id}
            open={expandedGroups.has(group.id)}
            onOpenChange={() => toggleGroup(group.id)}
            className="mb-8"
          >
            <CollapsibleTrigger className="flex items-center gap-3 w-full text-left group mb-4">
              <div className="flex items-center gap-3 flex-1">
                {group.poster_url ? (
                  <img
                    src={group.poster_url}
                    alt={group.title}
                    className="h-12 w-9 rounded-md object-cover shadow-md"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-12 w-9 rounded-md bg-muted flex items-center justify-center">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {group.title}
                  </h2>
                  {group.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{group.description}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-2">{group.anime.length} items</span>
              </div>
              {expandedGroups.has(group.id) ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              {group.anime.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {group.anime.map((a: any, i: number) => renderCard(a, i))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 pl-12">No anime in this group yet</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {ungrouped.length > 0 && (
        <div className="mb-8">
          {groups.length > 0 && <h2 className="text-xl font-bold text-foreground mb-4">Other Anime</h2>}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pagedUngrouped.map((a, i) => renderCard(a, i))}
          </div>
        </div>
      )}

      {totalFiltered === 0 && (
        <p className="py-20 text-center text-muted-foreground">{t("anime.noResults")}</p>
      )}

      {ungrouped.length > 0 && (
        <Paginator
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          showFirstLast={paginationConfig.show_first_last}
          showPrevNext={paginationConfig.show_prev_next}
          showPageNumbers={paginationConfig.show_page_numbers}
        />
      )}
    </div>
  );
};

export default AnimePage;