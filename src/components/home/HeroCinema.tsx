import { useEffect, useMemo, useState } from "react";
import { Play, Info, Plus, VolumeX, Volume2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { TrailerModal } from "@/components/TrailerModal";
import { useSectionItems } from "@/hooks/useHomeLayout";
import { useBatchContentTranslations } from "@/hooks/useBatchContentTranslations";
import { toast } from "sonner";

interface Slide {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  rating: number | null;
  year: number | null;
  genre: string[] | null;
  trailer_url: string | null;
  type: "movie" | "anime" | "series";
}

interface Props {
  sectionId: string;
  settings: any;
}

export function HeroCinema({ sectionId, settings }: Props) {
  const { items: manual } = useSectionItems(settings?.autoSelect ? null : sectionId);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(settings?.trailerMute ?? true);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { user } = useAuth();
  const { language, t } = useLanguage();

  useEffect(() => {
    (async () => {
      if (settings?.autoSelect !== false) {
        const { data } = await supabase
          .from("movies")
          .select("id,title,description,poster_url,rating,year,genre,trailer_url")
          .order("created_at", { ascending: false })
          .limit(settings?.slides ?? 6);
        setSlides(((data as any[]) || []).map((m) => ({ ...m, type: "movie" as const })));
      } else if (manual.length) {
        const byType: Record<string, string[]> = {};
        manual.forEach((m) => { (byType[m.content_type] ||= []).push(m.content_id); });
        const results: Slide[] = [];
        for (const [ct, ids] of Object.entries(byType)) {
          const tbl = ct === "movie" ? "movies" : ct === "anime" ? "anime" : "series";
          const { data } = await supabase.from(tbl as any).select("id,title,description,poster_url,rating,year,genre,trailer_url").in("id", ids);
          ((data as any[]) || []).forEach((r) => results.push({ ...r, type: ct as any }));
        }
        setSlides(results.sort((a, b) => manual.findIndex((m) => m.content_id === a.id) - manual.findIndex((m) => m.content_id === b.id)));
      }
    })();
  }, [settings?.autoSelect, settings?.slides, manual.length]);

  useEffect(() => {
    if (!settings?.autoplay || slides.length < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % slides.length), settings?.intervalMs ?? 7000);
    return () => window.clearInterval(id);
  }, [settings?.autoplay, settings?.intervalMs, slides.length]);

  const movieIds = slides.filter(s => s.type === "movie").map(s => s.id);
  const animeIds = slides.filter(s => s.type === "anime").map(s => s.id);
  const seriesIds = slides.filter(s => s.type === "series").map(s => s.id);
  const movieTr = useBatchContentTranslations(movieIds, "movie");
  const animeTr = useBatchContentTranslations(animeIds, "anime");
  const seriesTr = useBatchContentTranslations(seriesIds, "series");

  const localizedSlides = slides.map(s => {
    const tr = s.type === "movie" ? movieTr : s.type === "anime" ? animeTr : seriesTr;
    return {
      ...s,
      title: tr.getTitle(s.id, s.title),
      genre: tr.getGenre(s.id, s.genre || []),
      description: tr.getDescription(s.id, s.description),
    };
  });

  const current = localizedSlides[idx];
  const heightVh = settings?.heightVh ?? 92;
  const overlayOpacity = settings?.overlayOpacity ?? 0.55;
  const blur = settings?.blur ?? 0;

  const langPrefix = useMemo(() => (["ar", "fr", "es"].includes(language) ? `/${language}` : ""), [language]);

  const addWatchLater = async () => {
    if (!current) return;
    if (!user) { toast.error(t("hero.watchLater") + " — sign in required"); return; }
    await (supabase as any).from("watch_later").insert({ user_id: user.id, content_id: current.id, content_type: current.type });
    toast.success("Added to Watchlist");
  };

  if (!current) {
    return <div className="relative w-full animate-pulse bg-muted" style={{ height: `${heightVh}vh` }} />;
  }

  return (
    <section className="relative w-full overflow-hidden bg-black" style={{ height: `${heightVh}vh`, minHeight: 520 }}>
      <AnimatePresence mode="sync">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: (settings?.transitionMs ?? 900) / 1000, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <img
            src={current.poster_url || "/placeholder.svg"}
            alt={current.title}
            fetchPriority="high"
            className="h-full w-full object-cover"
            style={{ filter: blur ? `blur(${blur}px)` : undefined }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" style={{ opacity: overlayOpacity }} />

      <div className="container relative z-10 mx-auto flex h-full flex-col justify-end px-4 pb-16 sm:pb-24">
        <motion.div
          key={current.id + "-content"}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="max-w-2xl"
        >
          <div className="mb-3 flex items-center gap-3 text-xs">
            <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-semibold uppercase tracking-wider text-primary">HD</span>
            {current.rating ? (
              <span className="flex items-center gap-1 text-amber-400"><Star className="h-3.5 w-3.5 fill-current" /> {current.rating}</span>
            ) : null}
            {current.year && <span className="text-muted-foreground">{current.year}</span>}
          </div>
          <h1 className="mb-3 font-display text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl">
            {current.title}
          </h1>
          {current.genre?.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {current.genre.slice(0, 4).map((g) => (
                <span key={g} className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">{g}</span>
              ))}
            </div>
          ) : null}
          {current.description && (
            <p className="mb-6 max-w-xl text-sm leading-relaxed text-white/80 line-clamp-3 sm:text-base">{current.description}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2 gradient-brand text-primary-foreground shadow-2xl shadow-primary/30 hover:shadow-primary/50">
              <Link to={`${langPrefix}/${current.type === "movie" ? "movies" : current.type === "series" ? "series" : "anime"}/${current.id}`}>
                <Play className="h-5 w-5 fill-current" /> {t("hero.watchNow")}
              </Link>
            </Button>
            {current.trailer_url && (
              <Button size="lg" variant="secondary" className="gap-2 bg-white/10 text-white backdrop-blur hover:bg-white/20" onClick={() => setTrailerOpen(true)}>
                <Info className="h-5 w-5" /> Watch Trailer
              </Button>
            )}
            <Button size="lg" variant="outline" className="gap-2 border-white/30 bg-transparent text-white hover:bg-white/10" onClick={addWatchLater}>
              <Plus className="h-5 w-5" /> {t("hero.watchLater")}
            </Button>
          </div>
        </motion.div>

        {slides.length > 1 && (
          <div className="mt-8 flex items-center gap-3">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1 rounded-full transition-all ${i === idx ? "w-10 bg-primary" : "w-6 bg-white/30 hover:bg-white/50"}`}
              />
            ))}
            <button
              onClick={() => setMuted((m) => !m)}
              className="ml-auto rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

      {current.trailer_url && (
        <TrailerModal open={trailerOpen} onOpenChange={setTrailerOpen} trailerUrl={current.trailer_url} title={current.title} contentId={current.id} />
      )}
    </section>
  );
}
