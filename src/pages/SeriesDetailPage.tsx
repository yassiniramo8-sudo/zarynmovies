import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Star, Play, Heart, Plus, MessageCircle, Trash2, Send, Tv, ChevronLeft, ChevronRight, Check, Eye, EyeOff, Clock, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { ImageGallery } from "@/components/ImageGallery";
import { TrailerModal } from "@/components/TrailerModal";
import { ServerSelector } from "@/components/ServerSelector";
import { StarRating } from "@/components/StarRating";
import { useRatings } from "@/hooks/useRatings";
import { useLikes } from "@/hooks/useLikes";
import { useComments } from "@/hooks/useComments";
import { useUserBan } from "@/hooks/useUserBan";
import { useVipStatus } from "@/hooks/useVip";
import { VipContentGate } from "@/components/VipContentGate";
import { toast } from "sonner";
import { useTrackView } from "@/hooks/useTrackView";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import { useContentTranslations } from "@/hooks/useContentTranslations";
import { RelatedContent } from "@/components/RelatedContent";
import { setDetailPageActive } from "@/lib/navigationGuard";

interface SeriesDetail {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  genre: string[] | null;
  year: number | null;
  rating: number | null;
  trailer_url: string | null;
  gallery_images: string[] | null;
  vip_only?: boolean;
}

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  trailer_url: string | null;
  watch_servers: any;
  download_servers: any;
  visible: boolean;
}

const SeriesDetailPage = () => {
  // ───── ABSOLUTE NAVIGATION LOCK ─────
  // Under NO circumstances may this page redirect, go back, or navigate away
  // automatically. Window resize, DevTools open, missing server, null state,
  // iframe error — the user MUST stay on this route.
  useEffect(() => {
    const blockBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "" as any;
    };
    window.addEventListener("beforeunload", blockBeforeUnload);
    return () => window.removeEventListener("beforeunload", blockBeforeUnload);
  }, []);
  // ───── END NAVIGATION LOCK ─────

  const { id } = useParams();
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [trailerUrl, setTrailerUrl] = useState("");
  const [trailerTitle, setTrailerTitle] = useState("");
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState("");
  const [translating, setTranslating] = useState(false);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isVip } = useVipStatus();

  const contentType = "series";
  useTrackView(id, contentType);
  const { getTranslatedField, targetLang } = useContentTranslations(id, contentType);

  // Arm the guard SYNCHRONOUSLY during render — before any child component
  // (including iframes) is committed to the DOM. This eliminates the race
  // condition where DoodStream's iframe fires window.top.location.href
  // between DOM commit and useLayoutEffect execution.
  setDetailPageActive(true);
  useLayoutEffect(() => {
    return () => setDetailPageActive(false);
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!series) return;
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: { contentId: series.id, contentType, title: series.title, description: series.description || "" },
      });
      if (error) throw error;
      toast.success(`${t("toast.translated") || "Translated"} (${data?.translated || 0})`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }, [series, contentType]);

  useTrackView(id, "series");

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      const [seriesRes, episodesRes] = await Promise.all([
        supabase.from("series").select("*").eq("id", id).single(),
        supabase.from("episodes").select("*").eq("series_id", id).eq("visible", true).order("episode_number", { ascending: true }),
      ]);
      setSeries(seriesRes.data as SeriesDetail | null);
      const eps = (episodesRes.data as Episode[]) || [];
      setEpisodes(eps);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  // Fetch watched episodes for logged-in user
  useEffect(() => {
    if (!user || !id || episodes.length === 0) return;
    const fetchWatched = async () => {
      const { data } = await supabase
        .from("watch_history")
        .select("content_id")
        .eq("user_id", user.id)
        .eq("content_type", "episode")
        .in("content_id", episodes.map(e => e.id));
      if (data) setWatchedEpisodes(new Set(data.map(d => d.content_id)));
    };
    fetchWatched();
  }, [user, id, episodes]);

  const { averageRating, userRating, totalRatings, rate } = useRatings(id || "", contentType);
  const { liked, count: likeCount, toggle: toggleLike } = useLikes(id || "", contentType);
  const { comments, addComment, deleteComment } = useComments(id || "", contentType);
  const { isBanned, remainingText, reason: banReason } = useUserBan();

  const handleAddComment = async () => {
    await addComment(commentText);
    setCommentText("");
  };

  const addWatchLater = async () => {
    if (!user || !id) { toast.error(t("toast.signInToSave")); return; }
    const { error } = await supabase.from("watch_later").insert({
      user_id: user.id, content_id: id, content_type: contentType,
    });
    if (error?.code === "23505") toast.info(t("toast.alreadyInList"));
    else if (error) toast.error(error.message);
    else toast.success(t("toast.addedToWL"));
  };

  const openTrailer = (url: string, title: string) => {
    setTrailerUrl(url);
    setTrailerTitle(title);
    setTrailerOpen(true);
  };

  const toggleWatched = async (episodeId: string) => {
    if (!user) { toast.error(t("toast.signInToSave")); return; }
    const isWatched = watchedEpisodes.has(episodeId);
    if (isWatched) {
      await supabase.from("watch_history").delete().eq("user_id", user.id).eq("content_id", episodeId).eq("content_type", "episode");
      setWatchedEpisodes(prev => { const n = new Set(prev); n.delete(episodeId); return n; });
    } else {
      await supabase.from("watch_history").insert({ user_id: user.id, content_id: episodeId, content_type: "episode" });
      setWatchedEpisodes(prev => new Set(prev).add(episodeId));
    }
  };

  const activeEpisode = episodes.find(e => e.id === activeEpisodeId);
  const activeIndex = activeEpisode ? episodes.indexOf(activeEpisode) : -1;
  const prevEpisode = activeIndex > 0 ? episodes[activeIndex - 1] : null;
  const nextEpisode = activeIndex >= 0 && activeIndex < episodes.length - 1 ? episodes[activeIndex + 1] : null;

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!series) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("detail.contentNotFound")}</div>;

  const posterUrl = series.poster_url || "/placeholder.svg";
  const gallery = (series.gallery_images || []) as string[];
  const displayDescription = getTranslatedField(series, "description");
  const isRtl = targetLang === "ar";

  return (
    <div className="min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img src={posterUrl} alt={series.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto -mt-32 relative z-10 px-4 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-8 md:flex-row">
          <div className="w-48 shrink-0 overflow-hidden rounded-xl border border-border/50 shadow-2xl md:w-64">
            <img src={posterUrl} alt={series.title} className="h-full w-full object-cover" />
          </div>

          <div className="flex-1">
            <h1 className="mb-3 font-display text-4xl font-bold text-foreground md:text-5xl">{series.title}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StarRating value={averageRating} readonly size="md" showValue count={totalRatings} />
              {series.year && <span className="text-muted-foreground">{series.year}</span>}
              <Badge variant="outline" className="border-primary/50 text-primary">{episodes.length} {t("series.episodes")}</Badge>
              {series.genre?.map((g) => <Badge key={g} variant="outline" className="border-border/50">{g}</Badge>)}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("detail.yourRating")}</span>
              <StarRating value={userRating} onChange={rate} size="md" />
            </div>

            <p className="mb-6 max-w-2xl text-muted-foreground">{displayDescription}</p>

            <div className="flex flex-wrap gap-3">
              {series.trailer_url && (
                <Button size="lg" className="gap-2 gradient-brand text-primary-foreground" onClick={() => openTrailer(series.trailer_url!, series.title)}>
                  <Play className="h-5 w-5" /> {t("detail.watchTrailer")}
                </Button>
              )}
              <Button size="lg" variant={liked ? "default" : "ghost"} className="gap-2" onClick={toggleLike}>
                <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} /> {likeCount}
              </Button>
              <Button size="lg" variant="ghost" className="gap-2" onClick={addWatchLater}>
                <Plus className="h-5 w-5" /> {t("detail.watchLater")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={handleTranslate} disabled={translating}>
                {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                {t("detail.translate") || "Translate"}
              </Button>
              <SocialShareButtons title={series.title} description={displayDescription || undefined} />
            </div>
          </div>
        </motion.div>

        {/* Active Episode Player */}
        <AnimatePresence>
          {activeEpisode && (
            <motion.div
              key={activeEpisode.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-10 rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Badge className="gradient-brand text-primary-foreground mb-2">{t("series.nowPlaying")}</Badge>
                  <h3 className="text-xl font-bold text-foreground">
                    {t("series.episode")} {activeEpisode.episode_number}: {activeEpisode.title}
                  </h3>
                  {activeEpisode.description && <p className="text-sm text-muted-foreground mt-1">{activeEpisode.description}</p>}
                </div>
                <div className="flex gap-2">
                  {activeEpisode.trailer_url && (
                    <Button size="sm" variant="outline" onClick={() => openTrailer(activeEpisode.trailer_url!, `${series.title} - ${activeEpisode.title}`)}>
                      <Play className="h-3 w-3 mr-1" /> {t("detail.watchTrailer")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Episode Servers */}
              {(() => {
                const ws = Array.isArray(activeEpisode.watch_servers) ? activeEpisode.watch_servers : [];
                const ds = Array.isArray(activeEpisode.download_servers) ? activeEpisode.download_servers : [];
                return (ws.length > 0 || ds.length > 0) ? (
                  series?.vip_only && !isVip ? <VipContentGate /> : <ServerSelector watchServers={ws} downloadServers={ds} isVip={isVip} />
                ) : null;
              })()}

              {/* Episode Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!prevEpisode}
                  onClick={() => prevEpisode && setActiveEpisodeId(prevEpisode.id)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> {t("series.prevEpisode")}
                </Button>
                <div className="flex gap-2">
                  {user && (
                    <Button
                      variant={watchedEpisodes.has(activeEpisode.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleWatched(activeEpisode.id)}
                      className="gap-1"
                    >
                      <Check className="h-3 w-3" /> {watchedEpisodes.has(activeEpisode.id) ? t("series.watched") : t("series.markWatched")}
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!nextEpisode}
                  onClick={() => nextEpisode && setActiveEpisodeId(nextEpisode.id)}
                  className="gap-1"
                >
                  {t("series.nextEpisode")} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Episodes List */}
        <div className="mt-12">
          <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Tv className="h-6 w-6" /> {t("series.episodes")} ({episodes.length})
          </h2>
          {episodes.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {episodes.map((ep) => {
                const isActive = activeEpisodeId === ep.id;
                const isWatched = watchedEpisodes.has(ep.id);

                return (
                  <motion.button
                    key={ep.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveEpisodeId(isActive ? null : ep.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                        : "border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:bg-card/80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {ep.thumbnail_url ? (
                          <img src={ep.thumbnail_url} alt={ep.title} className="h-16 w-24 rounded-lg object-cover" />
                        ) : (
                          <div className="h-16 w-24 rounded-lg bg-muted flex items-center justify-center">
                            <Play className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        {isWatched && (
                          <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs shrink-0 ${isActive ? "border-primary text-primary" : "border-border/50 text-muted-foreground"}`}>
                            EP {ep.episode_number}
                          </Badge>
                          {ep.trailer_url && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openTrailer(ep.trailer_url!, `${series.title} - ${ep.title}`); }}
                              className="text-[10px] text-primary hover:underline"
                            >
                              ▶ Trailer
                            </button>
                          )}
                        </div>
                        <h3 className={`text-sm font-semibold truncate ${isWatched ? "text-muted-foreground" : "text-foreground"}`}>{ep.title}</h3>
                        {ep.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ep.description}</p>}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-muted-foreground">{t("series.noEpisodes")}</p>
          )}
        </div>

        {gallery.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 font-display text-2xl font-bold text-foreground">{t("detail.gallery")}</h2>
            <ImageGallery images={gallery} title={series.title} />
          </div>
        )}

        {/* Comments */}
        <div className="mt-16 max-w-2xl">
          <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <MessageCircle className="h-6 w-6" /> {t("detail.comments")} ({comments.length})
          </h2>
          {isBanned && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              🚫 {t("detail.banned")}{banReason ? ` ${t("admin.reason")}: ${banReason}` : ""}{remainingText ? ` (${remainingText})` : ""}
            </div>
          )}
          {user && !isBanned ? (
            <div className="flex gap-2 mb-6">
              <Textarea placeholder={t("detail.writeComment")} value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 border-border/50 bg-background/50" rows={2} />
              <Button onClick={handleAddComment} className="gradient-brand text-primary-foreground self-end" disabled={!commentText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : !user ? (
            <p className="mb-6 text-sm text-muted-foreground">{t("detail.signInToComment")}</p>
          ) : null}
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-border/50 bg-card p-4" style={c.highlighted && c.highlight_color ? { borderColor: c.highlight_color, borderWidth: 2 } : {}}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {c.profile?.avatar_url ? (
                      <img src={c.profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/20" />
                    )}
                    <span className="text-sm font-medium text-foreground">{c.profile?.username || "Anonymous"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                    {c.pinned && <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">Pinned</Badge>}
                  </div>
                  {user?.id === c.user_id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteComment(c.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">{t("detail.noComments")}</p>
            )}
          </div>
        </div>

        <RelatedContent currentId={id || ""} contentType="series" genres={series.genre} />
      </div>

      <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} trailerUrl={trailerUrl} title={trailerTitle} contentId={id} />
    </div>
  );
};

export default SeriesDetailPage;
