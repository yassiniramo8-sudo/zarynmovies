import { useState, useRef, useEffect } from "react";
import { Search, Star, Loader2, Film, Tv, Clapperboard, ArrowRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useGlobalSearch, type SearchResult } from "@/hooks/useGlobalSearch";

/* ------------------------------------------------------------------ */
/*  Type badge helper                                                  */
/* ------------------------------------------------------------------ */

function TypeBadge({ type }: { type: SearchResult["type"] }) {
  const [icon, label] =
    type === "movie"
      ? [<Film key="m" className="h-3 w-3" />, "Movie"]
      : type === "series"
        ? [<Tv key="s" className="h-3 w-3" />, "Series"]
        : [<Clapperboard key="a" className="h-3 w-3" />, "Anime"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        type === "movie" && "bg-blue-500/15 text-blue-400",
        type === "series" && "bg-emerald-500/15 text-emerald-400",
        type === "anime" && "bg-purple-500/15 text-purple-400"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Result row                                                         */
/* ------------------------------------------------------------------ */

function ResultRow({ item, onSelect }: { item: SearchResult; onSelect: () => void }) {
  const route =
    item.type === "movie" ? "movies" : item.type === "series" ? "series" : "anime";

  return (
    <Link
      to={`/${route}/${item.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
    >
      <img
        src={item.poster_url || "/placeholder.svg"}
        alt={item.title}
        className="h-12 w-9 flex-shrink-0 rounded-md object-cover"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white/90">{item.title}</span>
          <TypeBadge type={item.type} />
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-white/50">
          {item.rating && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {item.rating}
            </span>
          )}
          {item.year && <span>{item.year}</span>}
          {item.genre?.[0] && <span className="truncate">{item.genre[0]}</span>}
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick category filter chips                                        */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
] as const;

function CategoryChips({
  active,
  onChange,
}: {
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={cn(
            "rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-200",
            active === cat.value
              ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.15)] ring-1 ring-emerald-500/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main GlobalSearch component                                        */
/* ------------------------------------------------------------------ */

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
}

export function GlobalSearch({
  className,
  placeholder = "Search movies, series, anime...",
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { results, loading, totalCount, query: debouncedQuery } = useGlobalSearch(query);

  // Filter results by category chip
  const filteredResults = categoryFilter
    ? results.filter((r) => r.type === categoryFilter)
    : results;

  const hasResults = filteredResults.length > 0;
  const showDropdown = isOpen && query.length > 0;

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = () => {
    setIsOpen(false);
    setQuery("");
    setIsFocused(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    setIsFocused(false);
    const q = encodeURIComponent(query.trim());
    const cat = categoryFilter ? `&type=${categoryFilter}` : "";
    navigate(`/search?q=${q}${cat}`);
  };

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const viewAllLink = debouncedQuery
    ? `/search?q=${encodeURIComponent(debouncedQuery)}${categoryFilter ? `&type=${categoryFilter}` : ""}`
    : "#";

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      {/* Category chips above the search bar */}
      <div className="mb-3">
        <CategoryChips active={categoryFilter} onChange={setCategoryFilter} />
      </div>

      {/* Search input — stays in flow, never moves */}
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={cn(
            "relative rounded-xl transition-all duration-300",
            isFocused
              ? "scale-[1.01] shadow-[0_0_20px_rgba(34,197,94,0.25)] ring-2 ring-emerald-500/40"
              : "shadow-[0_0_10px_rgba(34,197,94,0.08)] hover:shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:ring-1 hover:ring-emerald-500/20"
          )}
        >
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400/80 drop-shadow-[0_0_4px_rgba(34,197,94,0.3)]" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              setIsFocused(true);
            }}
            onBlur={() => setIsFocused(false)}
            className="h-12 w-full border border-emerald-500/30 bg-slate-900/80 pl-10 pr-12 text-sm text-white placeholder:text-white/40 backdrop-blur-md rounded-xl transition-all duration-300"
          />

          {/* Clear button (X) — visible when query is non-empty */}
          {query && (
            <button
              type="button"
              onClick={clearQuery}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 transition-all duration-200 hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Loading spinner */}
          {loading && !query && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-400/60" />
          )}
        </div>
      </form>

      {/* 
        Dropdown — absolutely positioned relative to the parent wrapper.
        Floats OVER content, never pushes anything down.
        Only visible when query.length > 0 and input is active.
      */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-md"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          {hasResults ? (
            <div className="py-2">
              {filteredResults.map((item) => (
                <ResultRow key={`${item.type}-${item.id}`} item={item} onSelect={handleSelect} />
              ))}
            </div>
          ) : (
            !loading && (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-white/50">
                <Search className="h-8 w-8 opacity-30" />
                <span>
                  No results for "<strong className="text-white/70">{query}</strong>"
                </span>
              </div>
            )
          )}

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400/60" />
            </div>
          )}

          {/* View All link */}
          {hasResults && totalCount > filteredResults.length && (
            <Link
              to={viewAllLink}
              onClick={handleSelect}
              className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-medium text-emerald-400 transition-colors hover:bg-white/5"
            >
              View all {totalCount} results
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;