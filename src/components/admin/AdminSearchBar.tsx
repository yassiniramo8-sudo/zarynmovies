import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdminSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
  loading?: boolean;
}

/**
 * Reusable search bar for admin management tables.
 * Shows a search icon, live result counter, and a clear (X) button.
 */
export function AdminSearchBar({
  value,
  onChange,
  placeholder = "Search by title, year, or ID...",
  totalCount,
  filteredCount,
  loading,
}: AdminSearchBarProps) {
  const hasQuery = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-10 border-border/50 bg-background/50"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {hasQuery && !loading && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {typeof totalCount === "number" && typeof filteredCount === "number" && (
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          {hasQuery ? (
            <>Showing <span className="font-medium text-foreground">{filteredCount}</span> of <span className="font-medium text-foreground">{totalCount}</span> results</>
          ) : (
            <>{totalCount} {totalCount === 1 ? "item" : "items"}</>
          )}
        </p>
      )}
    </div>
  );
}