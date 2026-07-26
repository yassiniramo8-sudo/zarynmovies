import { useState, useCallback, useRef, useEffect } from "react";

export function useInfiniteScroll<T>(
  allItems: T[],
  pageSize = 20
) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const visibleItems = allItems.slice(0, visibleCount);
  const hasMore = visibleCount < allItems.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(prev + pageSize, allItems.length));
        }
      },
      { rootMargin: "200px" }
    );

    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, pageSize, allItems.length]);

  // Reset when items change
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [allItems.length, pageSize]);

  return { visibleItems, hasMore, loaderRef };
}
