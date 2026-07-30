import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export interface SearchResult {
  id: string;
  title: string;
  poster_url: string | null;
  rating: number | null;
  year: number | null;
  genre: string[] | null;
  type: "movie" | "anime" | "series";
}

interface SearchCache {
  [normalizedQuery: string]: SearchResult[];
}

const cache: SearchCache = {};

/**
 * Normalize a search string: lowercase, trim, collapse whitespace, remove diacritics.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Check if `text` matches the normalized `query`.
 * Supports:
 *   - Substring match (e.g. "spid" matches "Spider-Man")
 *   - Word-level match (e.g. "dark knight" matches "The Dark Knight")
 *   - Year match (e.g. "2023" matches items from 2023)
 *   - Genre match (e.g. "action" matches items with "Action" genre)
 */
function matches(text: string | null | undefined, query: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  const q = normalize(query);
  if (!q) return true;
  // Substring match
  if (normalized.includes(q)) return true;
  // Word-level: each query word must appear somewhere in the text
  const queryWords = q.split(" ");
  if (queryWords.length > 1) {
    return queryWords.every((word) => normalized.includes(word));
  }
  return false;
}

function matchesYear(year: number | null, query: string): boolean {
  if (!year || !query) return false;
  return normalize(String(year)).includes(normalize(query));
}

function matchesGenre(genres: string[] | null, query: string): boolean {
  if (!genres || !query) return false;
  const q = normalize(query);
  return genres.some((g) => normalize(g).includes(q));
}

/**
 * useGlobalSearch — Search across Movies, Anime, and Series simultaneously.
 *
 * Fetches all metadata once on mount (cached in memory), then filters
 * client-side for instant results. The debounced query prevents excessive
 * re-renders while typing.
 */
export function useGlobalSearch(rawQuery: string, debounceMs = 300) {
  const debouncedQuery = useDebouncedValue(rawQuery, debounceMs);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState<SearchResult[]>([]);
  const fetchedRef = useRef(false);

  // Fetch all searchable items once.
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const cacheKey = "__global_search_all";
        if (cache[cacheKey]) {
          setAllItems(cache[cacheKey]);
          setLoading(false);
          return;
        }

        const tables: Array<{ table: "movies" | "anime" | "series"; type: "movie" | "anime" | "series" }> = [
          { table: "movies", type: "movie" },
          { table: "anime", type: "anime" },
          { table: "series", type: "series" },
        ];

        const promises = tables.map(({ table, type }) =>
          supabase
            .from(table)
            .select("id,title,poster_url,rating,year,genre")
            .then(({ data }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((data as unknown as any[]) || []).map((item: Record<string, unknown>) => ({
                id: item.id as string,
                title: (item.title as string) || "",
                poster_url: item.poster_url as string | null,
                rating: item.rating as number | null,
                year: item.year as number | null,
                genre: item.genre as string[] | null,
                type,
              }))
            )
        );

        const all = (await Promise.all(promises)).flat();
        cache[cacheKey] = all;
        setAllItems(all);
      } catch (err) {
        console.error("[useGlobalSearch] fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // Filter results based on debounced query.
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length === 0) {
      setResults([]);
      return;
    }

    const q = debouncedQuery.trim();
    const cacheKey = `q:${normalize(q)}`;

    if (cache[cacheKey]) {
      setResults(cache[cacheKey]);
      return;
    }

    const filtered = allItems.filter((item) => {
      // Search by title
      if (matches(item.title, q)) return true;
      // Search by year
      if (matchesYear(item.year, q)) return true;
      // Search by genre
      if (matchesGenre(item.genre, q)) return true;
      return false;
    });

    // Limit to top 8 for the dropdown
    const top = filtered.slice(0, 8);
    cache[cacheKey] = top;
    setResults(top);
  }, [debouncedQuery, allItems]);

  return {
    results,
    loading,
    totalCount: debouncedQuery ? allItems.filter((item) => {
      const q = debouncedQuery.trim();
      if (matches(item.title, q)) return true;
      if (matchesYear(item.year, q)) return true;
      if (matchesGenre(item.genre, q)) return true;
      return false;
    }).length : 0,
    query: debouncedQuery,
  };
}