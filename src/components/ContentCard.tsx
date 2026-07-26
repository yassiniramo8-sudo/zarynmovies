import { useState, lazy, Suspense, useMemo, memo } from "react";
import { Star, Plus, Play, Heart, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useContentCounts } from "@/hooks/useContentCounts";
import { TrailerModal } from "@/components/TrailerModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { VipOverlayBadge } from "@/components/VipOverlayBadge";
import type { ContentItem } from "@/data/mock";

const CommentsModal = lazy(() => import("@/components/CommentsModal").then(m => ({ default: m.CommentsModal })));

interface ContentCardProps {
  item: ContentItem;
  index?: number;
}

export const ContentCard = memo(function ContentCard({ item, index = 99 }: ContentCardProps) {
  const routeType = item.type === "movie" ? "movies" : item.type === "series" ? "series" : "anime";
  const contentType = item.type === "movie" ? "movie" : item.type === "series" ? "series" : "anime";
  const counts = useContentCounts(item.id, contentType);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { t, language } = useLanguage();

  const isPriority = index < 4;

  const langPrefix = useMemo(() => {
    if (["ar", "fr", "es"].includes(language)) return `/${language}`;
    return "";
  }, [language]);
  const detailLink = `${langPrefix}/${routeType}/${item.id}`;

  const hasTrailer = !!item.trailer_url;

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <Link to={detailLink} className="relative overflow-hidden" style={{ aspectRatio: "2/3", contain: "layout" }}>
          {(item as any).vip_only && <VipOverlayBadge />}
          <img
            src={item.poster}
            alt={item.title}
            loading={isPriority ? "eager" : "lazy"}
            decoding="async"
            width={300}
            height={450}
            fetchPriority={isPriority ? "high" : "auto"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute bottom-3 left-3 right-3 flex gap-2 opacity-0 transition-all group-hover:opacity-100">
            <Button size="sm" className="flex-1 gap-1 gradient-brand text-primary-foreground">
              <Play className="h-3 w-3" /> {t("card.watch")}
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8 border-border/50 bg-background/50 backdrop-blur">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </Link>

        {hasTrailer && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTrailerOpen(true);
            }}
            className="absolute top-2 right-2 z-10 rounded-full bg-background/70 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/80"
            aria-label="Play trailer"
          >
            <Play className="h-4 w-4 text-foreground" />
          </button>
        )}

        <div className="flex flex-1 flex-col gap-1 p-3">
          <Link to={detailLink} className="line-clamp-1 font-medium text-foreground hover:text-primary transition-colors">
            {item.title}
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-accent fill-accent" />{item.rating}</span>
            <span>{item.year}</span>
            {item.genre?.[0] && <span className="truncate">{item.genre[0]}</span>}
          </div>
          <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground border-t border-border/30">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{counts.likes}</span>
            <button onClick={() => setCommentsOpen(true)} className="flex items-center gap-1 hover:text-primary transition-colors">
              <MessageCircle className="h-3 w-3" />{counts.comments}
            </button>
          </div>
        </div>
      </div>
      {trailerOpen && <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} trailerUrl={item.trailer_url!} title={item.title} contentId={item.id} />}
      {commentsOpen && (
        <Suspense fallback={null}>
          <CommentsModal contentId={item.id} contentType={contentType} open={commentsOpen} onOpenChange={setCommentsOpen} title={item.title} />
        </Suspense>
      )}
    </>
  );
});
