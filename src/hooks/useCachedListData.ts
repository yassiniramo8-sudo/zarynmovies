import { useState, useEffect, useRef } from "react";

const CACHE_PREFIX = "zaryn_list_cache_";

/**
 * Hook that caches fetched list data in sessionStorage so that when the user
 * navigates BACK to a listing page, the grid renders immediately with cached
 * items (preserving DOM height) while fresh data loads in the background.
 */
export function useCachedListData<T>(
  cacheKey: string,
  fetcher: () => Promise<T[]>
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const storageKey = CACHE_PREFIX + cacheKey;

    // 1) Try to load cached items immediately (synchronous — before paint)
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          setItems(cached);
          setLoading(false);
        }
      }
    } catch {
      // ignore cache read errors
    }

    // 2) Fetch fresh data in the background
    let cancelled = false;
    (async () => {
      try {
        const fresh = await fetcher();
        if (cancelled) return;
        setItems(fresh);
        setLoading(false);
        // Update cache
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(fresh));
        } catch {
          // ignore cache write errors
        }
      } catch (e) {
        console.error(`[useCachedListData] fetch failed for ${cacheKey}:`, e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return { items, setItems, loading };
}