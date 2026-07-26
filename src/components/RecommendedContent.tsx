import { useState, useEffect } from "react";
import { ContentCard } from "@/components/ContentCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles, Loader2 } from "lucide-react";

interface RecommendedContentProps {
  contentType?: "movie" | "anime" | "series";
  limit?: number;
}

export function RecommendedContent({ contentType = "movie", limit = 5 }: RecommendedContentProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("trending");
  const { user } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke("ai-recommendations", {
          body: { content_type: contentType, limit },
        });

        if (error) throw error;
        setItems(data?.recommendations || []);
        setSource(data?.source || "trending");
      } catch (e) {
        console.error("Recommendations error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [contentType, limit, user?.id]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl font-bold text-foreground">
          {source === "personalized" ? (t("index.recommendedForYou") || "Recommended for You") : (t("index.trending") || "Trending")}
        </h2>
        {source === "personalized" && (
          <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={{
              id: item.id,
              title: item.title,
              poster: item.poster_url || "/placeholder.svg",
              rating: item.rating || 0,
              year: item.year || 0,
              genre: item.genre || [],
              description: item.description || "",
              type: contentType,
              trending: item.trending || false,
              trailer_url: item.trailer_url,
            }}
          />
        ))}
      </div>
    </section>
  );
}
