import { useState, useEffect } from "react";
import { HeroSection } from "@/components/HeroSection";
import { SectionHeader } from "@/components/SectionHeader";
import { ContentCard } from "@/components/ContentCard";
import { SEOHead } from "@/components/SEOHead";
import { RecommendedContent } from "@/components/RecommendedContent";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";

interface DbItem {
  id: string;
  title: string;
  poster_url: string | null;
  rating: number | null;
  year: number | null;
  genre: string[] | null;
  description: string | null;
  trending: boolean | null;
  pinned: boolean | null;
  trailer_url: string | null;
}

const toCard = (item: DbItem, type: "movie" | "anime" | "series") => ({
  id: item.id,
  title: item.title,
  poster: item.poster_url || "/placeholder.svg",
  rating: item.rating || 0,
  year: item.year || 0,
  genre: item.genre || [],
  description: item.description || "",
  type,
  trending: item.trending || false,
  pinned: item.pinned || false,
  trailer_url: item.trailer_url,
});

const Index = () => {
  const [movies, setMovies] = useState<DbItem[]>([]);
  const [animeList, setAnimeList] = useState<DbItem[]>([]);
  const [seriesList, setSeriesList] = useState<DbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    Promise.all([
      supabase.from("movies").select("*").order("created_at", { ascending: false }),
      supabase.from("anime").select("*").order("created_at", { ascending: false }),
      supabase.from("series").select("*").eq("visible", true).order("created_at", { ascending: false }),
    ]).then(([moviesRes, animeRes, seriesRes]) => {
      setMovies((moviesRes.data as DbItem[]) || []);
      setAnimeList((animeRes.data as DbItem[]) || []);
      setSeriesList((seriesRes.data as DbItem[]) || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const allItems = [...movies.map((m) => toCard(m, "movie")), ...animeList.map((a) => toCard(a, "anime")), ...seriesList.map((s) => toCard(s, "series"))];
  const trending = allItems.filter((i) => i.trending);
  const latestMovies = movies.slice(0, 10).map((m) => toCard(m, "movie"));
  const topMovies = [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10).map((m) => toCard(m, "movie"));
  const popularMovies = [...movies].filter((m) => m.trending).slice(0, 10).map((m) => toCard(m, "movie"));
  const latestAnime = animeList.slice(0, 4).map((a) => toCard(a, "anime"));
  const latestSeries = seriesList.slice(0, 4).map((s) => toCard(s, "series"));
  const topAnime = [...animeList].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4).map((a) => toCard(a, "anime"));

  const hasContent = allItems.length > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zaryn Movies",
    url: window.location.origin,
    potentialAction: {
      "@type": "SearchAction",
      target: `${window.location.origin}/movies?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen">
      <SEOHead
        title="Stream Movies, Anime & Series"
        description="Zaryn Movies — Your ultimate destination for streaming movies, anime, TV series, and reading engaging articles. Discover trending content now."
        jsonLd={jsonLd}
      />

      <HeroSection featured={latestMovies.find((i) => i.trending) || latestMovies[0] || allItems[0]} />

      <div className="container mx-auto space-y-16 px-4 py-12">
        <AdvertisementRenderer placement="home_top" />
        {latestMovies.length > 0 && (
          <section>
            <SectionHeader title={t("index.latestMovies")} href="/movies" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {latestMovies.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {topMovies.length > 0 && (
          <section>
            <SectionHeader title={t("index.topRatedMovies")} href="/movies" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {topMovies.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {popularMovies.length > 0 && (
          <section>
            <SectionHeader title={t("index.popularMovies")} href="/movies" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {popularMovies.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <section>
            <SectionHeader title={t("index.trending")} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {trending.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        <AdvertisementRenderer placement="home_middle" />

        <RecommendedContent contentType="movie" limit={5} />

        {latestAnime.length > 0 && (
          <section>
            <SectionHeader title={t("index.latestAnime")} href="/anime" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {latestAnime.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {latestSeries.length > 0 && (
          <section>
            <SectionHeader title={t("index.latestSeries")} href="/series" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {latestSeries.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {topAnime.length > 0 && (
          <section>
            <SectionHeader title={t("index.topRatedAnime")} href="/anime" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {topAnime.map((item) => <ContentCard key={item.id} item={item} />)}
            </div>
          </section>
        )}

        {!hasContent && (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">{t("index.noContent")}</p>
          </div>
        )}

        <AdvertisementRenderer placement="home_bottom" />
      </div>
    </div>
  );
};

export default Index;
