import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Heart, Film, Tv, Image, FileText, ExternalLink, Trash2, Clapperboard, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type ContentItem = { id: string; content_id: string; content_type: string; title?: string; poster_url?: string; created_at: string; };
type Tab = "mymovies" | "watchlater" | "liked";

const enrichItems = async (items: any[]) => {
  const enriched: ContentItem[] = [];
  for (const item of items || []) {
    let title = "Unknown", poster = "";
    if (item.content_type === "movie") { const { data } = await supabase.from("movies").select("title, poster_url").eq("id", item.content_id).single(); title = data?.title || title; poster = data?.poster_url || ""; }
    else if (item.content_type === "anime") { const { data } = await supabase.from("anime").select("title, poster_url").eq("id", item.content_id).single(); title = data?.title || title; poster = data?.poster_url || ""; }
    else if (item.content_type === "article") { const { data } = await supabase.from("articles").select("title, cover_url").eq("id", item.content_id).single(); title = data?.title || title; poster = data?.cover_url || ""; }
    else { const { data } = await supabase.from("highlights").select("title_en, thumbnail_url").eq("id", item.content_id).single(); title = data?.title_en || title; poster = data?.thumbnail_url || ""; }
    enriched.push({ ...item, title, poster_url: poster });
  }
  return enriched;
};

export function ProfileContentLists() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("mymovies");
  const [watchLater, setWatchLater] = useState<ContentItem[]>([]);
  const [liked, setLiked] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [wlRes, likesRes] = await Promise.all([
      supabase.from("watch_later").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("likes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const [wl, lk] = await Promise.all([enrichItems(wlRes.data || []), enrichItems(likesRes.data || [])]);
    setWatchLater(wl);
    setLiked(lk);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const movieWatchLater = watchLater.filter((i) => i.content_type === "movie");
  const movieLiked = liked.filter((i) => i.content_type === "movie");

  const handleRemoveWatchLater = async (itemId: string) => {
    const { error } = await supabase.from("watch_later").delete().eq("id", itemId);
    if (error) { toast.error("Failed to remove"); return; }
    setWatchLater((prev) => prev.filter((i) => i.id !== itemId));
    toast.success(t("toast.removedFromWL"));
  };

  const handleRemoveLike = async (itemId: string) => {
    const { error } = await supabase.from("likes").delete().eq("id", itemId);
    if (error) { toast.error("Failed to remove"); return; }
    setLiked((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Removed from liked");
  };

  const getIcon = (type: string) => {
    switch (type) { case "movie": return <Film className="h-3.5 w-3.5" />; case "anime": return <Tv className="h-3.5 w-3.5" />; case "background": return <Image className="h-3.5 w-3.5" />; case "article": return <FileText className="h-3.5 w-3.5" />; default: return <Film className="h-3.5 w-3.5" />; }
  };

  const getLink = (item: ContentItem) => {
    const type = item.content_type === "movie" ? "movies" : item.content_type === "anime" ? "anime" : item.content_type === "article" ? "articles" : "highlights";
    return `/${type}/${item.content_id}`;
  };

  const tabs = [
    { key: "mymovies" as Tab, label: t("lists.myMovies"), icon: Clapperboard, count: movieWatchLater.length + movieLiked.length },
    { key: "watchlater" as Tab, label: t("lists.watchLater"), icon: Bookmark, count: watchLater.length },
    { key: "liked" as Tab, label: t("lists.liked"), icon: Heart, count: liked.length },
  ];

  const renderItemCard = (item: ContentItem, onRemove?: (id: string) => void) => (
    <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="group flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 p-3 transition-all hover:bg-background/50 hover:border-primary/30 hover:shadow-md">
      <Link to={getLink(item)} className="flex flex-1 items-center gap-3 min-w-0">
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-muted/50">
          {item.poster_url ? <img src={item.poster_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" /> : (
            <div className="flex h-full w-full items-center justify-center">{getIcon(item.content_type)}</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">{getIcon(item.content_type)}<span className="capitalize">{item.content_type}</span></div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </Link>
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.preventDefault(); onRemove(item.id); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </motion.div>
  );

  const renderWatchLaterContent = () => {
    if (watchLater.length === 0) return <p className="text-sm text-muted-foreground">{t("lists.emptyWatchLater")}</p>;
    const movieItems = watchLater.filter((i) => i.content_type === "movie");
    const animeItems = watchLater.filter((i) => i.content_type === "anime");
    const bgItems = watchLater.filter((i) => i.content_type === "background");
    const articleItems = watchLater.filter((i) => i.content_type === "article");

    const sections = [
      { label: t("admin.movies"), icon: <Film className="h-4 w-4 text-primary" />, items: movieItems },
      { label: t("admin.anime"), icon: <Tv className="h-4 w-4 text-primary" />, items: animeItems },
      { label: t("admin.backgrounds"), icon: <Image className="h-4 w-4 text-primary" />, items: bgItems },
      { label: t("admin.articles"), icon: <FileText className="h-4 w-4 text-primary" />, items: articleItems },
    ].filter((s) => s.items.length > 0);

    return (
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">{section.icon} {section.label}<span className="text-xs text-muted-foreground font-normal">({section.items.length})</span></h3>
            <div className="grid gap-3 sm:grid-cols-2"><AnimatePresence>{section.items.map((item) => renderItemCard(item, handleRemoveWatchLater))}</AnimatePresence></div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <p className="text-sm text-muted-foreground">{t("profile.loading")}</p>;
    if (activeTab === "mymovies") {
      const hasContent = movieWatchLater.length > 0 || movieLiked.length > 0;
      if (!hasContent) return <p className="text-sm text-muted-foreground">{t("lists.noMovies")}</p>;
      return (
        <div className="space-y-6">
          {movieWatchLater.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {t("lists.watchLater")}<span className="text-xs text-muted-foreground font-normal">({movieWatchLater.length})</span></h3>
              <div className="grid gap-3 sm:grid-cols-2"><AnimatePresence>{movieWatchLater.map((item) => renderItemCard(item, handleRemoveWatchLater))}</AnimatePresence></div>
            </div>
          )}
          {movieLiked.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-destructive" /> {t("lists.liked")}<span className="text-xs text-muted-foreground font-normal">({movieLiked.length})</span></h3>
              <div className="grid gap-3 sm:grid-cols-2"><AnimatePresence>{movieLiked.map((item) => renderItemCard(item, handleRemoveLike))}</AnimatePresence></div>
            </div>
          )}
        </div>
      );
    }
    if (activeTab === "watchlater") return renderWatchLaterContent();
    if (liked.length === 0) return <p className="text-sm text-muted-foreground">{t("lists.noLiked")}</p>;
    return (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><AnimatePresence>{liked.map((item) => renderItemCard(item, handleRemoveLike))}</AnimatePresence></div>);
  };

  const activeTabData = tabs.find((t) => t.key === activeTab)!;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col gap-4 lg:flex-row">
      <div className="flex lg:flex-col gap-2 lg:w-16 shrink-0">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative flex flex-col items-center gap-1 rounded-xl p-3 transition-all duration-200 ${activeTab === tab.key ? "bg-primary/15 text-primary shadow-md shadow-primary/10" : "bg-card/40 text-muted-foreground hover:bg-card/60 hover:text-foreground"} border border-border/30 backdrop-blur-sm`}>
            <div className="relative">
              <tab.icon className="h-5 w-5" />
              {tab.count > 0 && (
                <Badge variant="secondary" className="absolute -top-2.5 -right-3.5 h-4 min-w-4 px-1 text-[9px] font-bold leading-none flex items-center justify-center rounded-full bg-primary text-primary-foreground border-0">
                  {tab.count > 99 ? "99+" : tab.count}
                </Badge>
              )}
            </div>
            <span className="text-[10px] font-medium mt-1">{tab.key === "watchlater" ? t("lists.later") : tab.key === "mymovies" ? t("lists.movies") : t("lists.liked")}</span>
          </button>
        ))}
      </div>

      <Card className="flex-1 border-border/30 bg-card/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <activeTabData.icon className={`h-5 w-5 ${activeTab === "liked" ? "text-destructive" : "text-primary"}`} />
            {activeTabData.label}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </motion.div>
  );
}
