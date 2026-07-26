import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Star, Play, Heart, Plus, MessageCircle, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { ImageGallery } from "@/components/ImageGallery";
import { TrailerModal } from "@/components/TrailerModal";
import { ServerSelector } from "@/components/ServerSelector";
import { StarRating } from "@/components/StarRating";
import { useRatings } from "@/hooks/useRatings";
import { useLikes } from "@/hooks/useLikes";
import { useUserBan } from "@/hooks/useUserBan";
import { CommentsSection } from "@/components/CommentsSection";
import { SEOHead } from "@/components/SEOHead";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { RelatedContent } from "@/components/RelatedContent";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { VipContentGate } from "@/components/VipContentGate";
import { VipOverlayBadge } from "@/components/VipOverlayBadge";
import { useVipStatus } from "@/hooks/useVip";
import { toast } from "sonner";
import { useTrackView } from "@/hooks/useTrackView";
import { useContentTranslations } from "@/hooks/useContentTranslations";
import { setDetailPageActive } from "@/lib/navigationGuard";

interface DetailItem {
  id: string;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  cover_url?: string | null;
  genre?: string[] | null;
  year?: number | null;
  rating?: number | null;
  trailer_url?: string | null;
  watch_servers?: any;
  download_servers?: any;
  gallery_images?: string[] | null;
  content?: string | null;
  excerpt?: string | null;
  vip_only?: boolean;
}

const DetailPage = () => {
  // ───── ABSOLUTE NAVIGATION LOCK ─────
  // Under NO circumstances may this page redirect, go back, or navigate away
  // automatically. Window resize, DevTools open, missing server, null state,
  // iframe error — the user MUST stay on this route.
  useEffect(() => {
    const blockBeforeUnload = (e: BeforeUnloadEvent) => {
      // This handler does nothing — it merely registers an event listener so
      // the browser cannot silently fire a cross-origin iframe-initiated
      // location.href redirect without triggering the standard confirmation
      // dialog (which is suppressed by our main guard in navigationGuard.ts).
      e.preventDefault();
      e.returnValue = "" as any;
    };
    window.addEventListener("beforeunload", blockBeforeUnload);
    return () => window.removeEventListener("beforeunload", blockBeforeUnload);
  }, []);
  // ───── END NAVIGATION LOCK ─────

  const { id, lang: urlLang } = useParams();
  const location = useLocation();
  const [item, setItem] = useState<DetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { isVip } = useVipStatus();

  // Sync language from URL locale prefix
  useEffect(() => {
    if (urlLang && ["ar", "en", "fr", "es"].includes(urlLang) && urlLang !== language) {
      setLanguage(urlLang as any);
    }
  }, [urlLang]);

  const pathWithoutLang = urlLang ? location.pathname.replace(`/${urlLang}`, '') : location.pathname;
  const routeType = pathWithoutLang.startsWith("/anime") ? "anime"
    : pathWithoutLang.startsWith("/articles") ? "articles" : "movies";
  const tableName = routeType as "movies" | "anime" | "articles";
  const contentType = routeType === "movies" ? "movie" : routeType === "articles" ? "article" : "anime";

  const { getTranslatedField, targetLang } = useContentTranslations(id, contentType);

  // Arm the guard SYNCHRONOUSLY during render — before any child component
  // (including iframes) is committed to the DOM. This eliminates the race
  // condition where DoodStream's iframe fires window.top.location.href
  // between DOM commit and useLayoutEffect execution.
  setDetailPageActive(true);
  useLayoutEffect(() => {
    return () => setDetailPageActive(false);
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from(tableName).select("*").eq("id", id).single();
      setItem(data as DetailItem | null);
      setLoading(false);
    };
    fetch();
  }, [id, tableName]);

  useTrackView(id, contentType);
  const { averageRating, userRating, totalRatings, rate } = useRatings(id || "", contentType);
  const { liked, count: likeCount, toggle: toggleLike } = useLikes(id || "", contentType);
  const { isBanned, remainingText, reason: banReason } = useUserBan();

  const handleTranslate = useCallback(async () => {
    if (!item) return;
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: {
          contentId: item.id,
          contentType,
          title: item.title,
          description: item.description || item.excerpt || "",
        },
      });
      if (error) throw error;
      toast.success(`${t("toast.translated") || "Translated"} (${data?.translated || 0})`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }, [item, contentType]);

  const addWatchLater = async () => {
    if (!user || !id) { toast.error(t("toast.signInToSave")); return; }
    if (isBanned) { toast.error(`${t("detail.banned")} ${remainingText || ""}`); return; }
    const { error } = await supabase.from("watch_later").insert({
      user_id: user.id, content_id: id, content_type: contentType,
    });
    if (error?.code === "23505") toast.info(t("toast.alreadyInList"));
    else if (error) toast.error(error.message);
    else toast.success(t("toast.addedToWL"));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!item) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("detail.contentNotFound")}</div>;

  // VIP-only content gate — non-VIP users see upgrade prompt
  const isVipOnly = !!(item as any).vip_only;
  const blockedByVip = isVipOnly && !isVip;

  // Use translation layer — movie titles never translated
  const displayTitle = getTranslatedField(item, "title");
  const displayDescription = getTranslatedField(item, "description");
  const displayContent = item.content ? getTranslatedField(item, "content") : "";

  const posterUrl = item.poster_url || item.cover_url || "/placeholder.svg";
  const gallery = (item.gallery_images || []) as string[];
  const watchServers = Array.isArray(item.watch_servers) ? item.watch_servers : [];
  const downloadServers = Array.isArray(item.download_servers) ? item.download_servers : [];
  const isArticle = routeType === "articles";

  const ogType = isArticle ? "article" as const : "video.movie" as const;
  const jsonLd = isArticle
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: displayTitle,
        description: displayDescription || "",
        image: posterUrl,
        datePublished: item.year ? `${item.year}-01-01` : undefined,
      }
    : {
        "@context": "https://schema.org",
        "@type": "Movie",
        name: item.title, // Always original title for SEO
        description: displayDescription || "",
        image: posterUrl,
        genre: item.genre,
        datePublished: item.year ? `${item.year}-01-01` : undefined,
        aggregateRating: averageRating > 0 ? {
          "@type": "AggregateRating",
          ratingValue: averageRating,
          bestRating: 5,
          ratingCount: totalRatings,
        } : undefined,
      };

  const isRtl = targetLang === "ar";

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <SEOHead
        title={displayTitle}
        description={displayDescription || `Watch ${item.title} on Zaryn Movies`}
        image={posterUrl}
        type={ogType}
        tags={item.genre || undefined}
        jsonLd={jsonLd}
      />

      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img src={posterUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto -mt-32 relative z-10 px-4 pb-16">
        <AdvertisementRenderer placement="movie_detail_top" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-8 md:flex-row">
          {!isArticle && (
            <div className="w-48 shrink-0 overflow-hidden rounded-xl border border-border/50 shadow-2xl md:w-64">
              <img src={posterUrl} alt={item.title} className="h-full w-full object-cover" loading="eager" />
            </div>
          )}

          <div className="flex-1">
            <h1 className="mb-3 font-display text-4xl font-bold text-foreground md:text-5xl">{displayTitle}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StarRating value={averageRating} readonly size="md" showValue count={totalRatings} />
              {item.year && <span className="text-muted-foreground">{item.year}</span>}
              {item.genre?.map((g) => <Badge key={g} variant="outline" className="border-border/50">{g}</Badge>)}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("detail.yourRating")}</span>
              <StarRating value={userRating} onChange={rate} size="md" />
            </div>

            <p className="mb-6 max-w-2xl text-muted-foreground">{displayDescription}</p>

            <div className="flex flex-wrap items-center gap-3">
              {item.trailer_url && (
                <Button size="lg" className="gap-2 gradient-brand text-primary-foreground" onClick={() => setTrailerOpen(true)}>
                  <Play className="h-5 w-5" /> {t("detail.watchTrailer")}
                </Button>
              )}
              <Button size="lg" variant={liked ? "default" : "ghost"} className="gap-2" onClick={toggleLike}>
                <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} /> {likeCount}
              </Button>
              {!isArticle && (
                <Button size="lg" variant="ghost" className="gap-2" onClick={addWatchLater}>
                  <Plus className="h-5 w-5" /> {t("detail.watchLater")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={handleTranslate}
                disabled={translating}
              >
                {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                {t("detail.translate") || "Translate"}
              </Button>
              <SocialShareButtons title={displayTitle} description={displayDescription || undefined} />
            </div>

          </div>
        </motion.div>

        {blockedByVip ? (
          <div className="mt-12">
            <VipContentGate />
          </div>
        ) : (
          <>
            {isArticle && displayContent && (
              <div className="mt-10 max-w-3xl prose prose-invert">
                <div className="text-foreground whitespace-pre-wrap">{displayContent}</div>
              </div>
            )}

            {gallery.length > 0 && (
              <div className="mt-12">
                <h2 className="mb-4 font-display text-2xl font-bold text-foreground">{t("detail.gallery")}</h2>
                <ImageGallery images={gallery} title={item.title} />
              </div>
            )}

            {(watchServers.length > 0 || downloadServers.length > 0) && (
              <div className="mt-12 w-full">
                <h2 className="mb-4 font-display text-2xl font-bold text-foreground">{t("detail.servers")}</h2>
                <ErrorBoundary name="Player">
                  <ServerSelector watchServers={watchServers} downloadServers={downloadServers} contentId={id} contentType={contentType} isVip={isVip} />
                </ErrorBoundary>
              </div>
            )}

            <AdvertisementRenderer placement="before_comments" />
            <ErrorBoundary name="Comments">
              <CommentsSection contentId={id || ""} contentType={contentType} />
            </ErrorBoundary>

            {!isArticle && (
              <>
                <AdvertisementRenderer placement="related_movies" />
                <ErrorBoundary name="Related">
                  <RelatedContent currentId={id || ""} contentType={contentType as "movie" | "anime"} genres={item.genre} />
                </ErrorBoundary>
              </>
            )}
            <AdvertisementRenderer placement="movie_detail_bottom" />
          </>
        )}
      </div>

      {item.trailer_url && (
        <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} trailerUrl={item.trailer_url} title={item.title} contentId={id} />
      )}
    </div>
  );
};

export default DetailPage;
