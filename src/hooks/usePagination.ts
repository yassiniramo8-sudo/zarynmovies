import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export interface PaginationState {
  page: number;
  pageSize: number;
}

export function usePagination(defaultPageSize = 25) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    return Number.isFinite(p) && p >= 1 ? p : 1;
  }, [searchParams]);

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(p));
    }
    setSearchParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Reset to page 1 (e.g. when filters change) */
  const resetPage = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    setSearchParams(next, { replace: true });
  };

  return { page, setPage, resetPage, pageSize: defaultPageSize };
}