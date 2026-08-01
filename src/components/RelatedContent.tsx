import { useState, useEffect } from "react";
import { ContentCard } from "@/components/ContentCard";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBatchContentTranslations } from "@/hooks/useBatchContentTranslations";

interface RelatedContentProps {
  currentId: string;
  contentType: "movie" | "anime" | "series";
  genres?: string[] | null;
  limit?: number;
}

export function RelatedContent({ currentId, contentType, genres, limit = 6 }: RelatedContentProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const table = contentType === "movie" ? "movies" : contentType === "anime" ? "anime" : "series";

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true);
      let results: any[] = [];

      // First try: match by genre
      if (genres?.length) {
        const { data } = await supabase
          .from(table)
          .select("*")
          .neq("id", currentId)
          .overlaps("genre", genres)
          .order("rating", { ascending: false })
          .limit(limit);
        results = data || [];
      }

      // Fallback: if no genre matches, fetch latest content
      if (results.length === 0) {
        const { data } = await supabase
          .from(table)
          .select("*")
          .neq("id", currentId)
          .order("created_at", { ascending: false })
          .limit(limit);
        results = data || [];
      }

      setItems(results);
      setLoading(false);
    };
    fetchRelated();
  }, [currentId, table, genres, limit]);

  const { getDescription, getTitle, getGenre } = useBatchContentTranslations(
    items.map(i => i.id),
    contentType
  );

  if (!loading && items.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-6 font-display text-2xl font-bold text-foreground">
        {t("detail.relatedContent") || "You May Also Like"}
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={{
                id: item.id,
                title: getTitle(item.id, item.title),
                poster: item.poster_url || "/placeholder.svg",
                rating: item.rating || 0,
                year: item.year || 0,
                genre: getGenre(item.id, item.genre || []),
                description: getDescription(item.id, item.description),
                type: contentType,
                trending: item.trending || false,
                trailer_url: item.trailer_url,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
