import { memo, useMemo } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export interface PaginatorProps {
  /** 1-based current page */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Called when user clicks a page number / nav button */
  onPageChange: (page: number) => void;
  /** Show First / Last buttons */
  showFirstLast?: boolean;
  /** Show Previous / Next buttons */
  showPrevNext?: boolean;
  /** Show individual page numbers */
  showPageNumbers?: boolean;
  /** Extra class name */
  className?: string;
}

/**
 * Builds the array of page numbers (and ellipsis markers) to display.
 * Logic: always show 1, last, current ± 2, with "..." gaps.
 */
function buildPageRange(current: number, total: number): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];

  // Always include first page
  pages.push(1);

  // Define window around current
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(total - 1, current + 1);

  if (windowStart > 2) {
    pages.push("ellipsis-start");
  } else if (windowStart === 2) {
    pages.push(2);
  }

  for (let i = windowStart; i <= windowEnd; i++) {
    if (i > 1 && i < total) {
      pages.push(i);
    }
  }

  if (windowEnd < total - 1) {
    pages.push("ellipsis-end");
  } else if (windowEnd === total - 1) {
    pages.push(total - 1);
  }

  // Always include last page (if > 1)
  if (total > 1) pages.push(total);

  // Deduplicate sequential numbers (edge case when total is small)
  const deduped: (number | "ellipsis-start" | "ellipsis-end")[] = [];
  for (const p of pages) {
    if (typeof p === "number" && typeof deduped[deduped.length - 1] === "number" && deduped[deduped.length - 1] === p) {
      continue;
    }
    deduped.push(p);
  }
  return deduped;
}

export const Paginator = memo(function Paginator({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  showPrevNext = true,
  showPageNumbers = true,
  className,
}: PaginatorProps) {
  const range = useMemo(() => buildPageRange(currentPage, totalPages), [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <Pagination className={cn("py-6", className)}>
      <PaginationContent>
        {/* First Page */}
        {showFirstLast && currentPage > 2 && (
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(1);
              }}
              className="hidden sm:inline-flex"
            >
              ««
            </PaginationLink>
          </PaginationItem>
        )}

        {/* Previous */}
        {showPrevNext && (
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) onPageChange(currentPage - 1);
              }}
              className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        )}

        {/* Page Numbers */}
        {showPageNumbers &&
          range.map((item, idx) => {
            if (item === "ellipsis-start" || item === "ellipsis-end") {
              return (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }
            const pageNum = item as number;
            return (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  href="#"
                  isActive={pageNum === currentPage}
                  onClick={(e) => {
                    e.preventDefault();
                    if (pageNum !== currentPage) onPageChange(pageNum);
                  }}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            );
          })}

        {/* Next */}
        {showPrevNext && (
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) onPageChange(currentPage + 1);
              }}
              className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        )}

        {/* Last Page */}
        {showFirstLast && currentPage < totalPages - 1 && (
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(totalPages);
              }}
              className="hidden sm:inline-flex"
            >
              »»
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
});

export default Paginator;