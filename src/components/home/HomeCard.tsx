import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { VipOverlayBadge } from "@/components/VipOverlayBadge";
import { useMemo } from "react";

export interface HomeCardItem {
  id: string;
  title: string;
  poster_url: string | null;
  rating?: number | null;
  year?: number | null;
  type: "movie" | "anime" | "series";
  vip_only?: boolean;
}

interface Props {
  item: HomeCardItem;
  priority?: boolean;
  progressPct?: number;
}

/** Slim, cinematic card used across all homepage rails. */
export function HomeCard({ item, priority, progressPct }: Props) {
  const { language } = useLanguage();
  const langPrefix = useMemo(() => (["ar", "fr", "es"].includes(language) ? `/${language}` : ""), [language]);
  const route = item.type === "movie" ? "movies" : item.type === "series" ? "series" : "anime";

  return (
    <Link
      to={`${langPrefix}/${route}/${item.id}`}
      tabIndex={0}
      role="link"
      aria-label={item.title}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      className="group relative block cursor-pointer overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm outline-none transition-all duration-300 will-change-transform hover:z-10 hover:scale-[1.04] hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 focus-visible:z-10 focus-visible:scale-[1.04] focus-visible:border-primary/60 focus-visible:shadow-2xl focus-visible:shadow-primary/20 focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.98] touch-manipulation"
      style={{ aspectRatio: "2/3" }}
    >
      {item.vip_only && <VipOverlayBadge />}
      <img
        src={item.poster_url || "/placeholder.svg"}
        alt={item.title}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className="mb-1 flex items-center gap-2 text-[10px] text-white/70">
          {item.rating ? <span className="text-amber-400">★ {item.rating}</span> : null}
          {item.year ? <span>{item.year}</span> : null}
        </div>
        <div className="line-clamp-2 text-sm font-semibold text-white">{item.title}</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
          <Play className="h-3 w-3 fill-current" /> Play
        </div>
      </div>
      {typeof progressPct === "number" && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
        </div>
      )}
    </Link>
  );
}
