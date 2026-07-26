import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const scanType = body.type || "all"; // "movies", "tv", "anime", "rss", "all"
    const language = body.language || "en-US";

    const results: any[] = [];

    // Scan trending movies from TMDb
    if (scanType === "all" || scanType === "movies") {
      const moviesRes = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=${language}`);
      const moviesData = await moviesRes.json();

      const { data: existingMovies } = await supabase
        .from("movies")
        .select("title")
        .limit(1000);
      const existingTitles = new Set((existingMovies || []).map((m: any) => m.title.toLowerCase()));

      for (const movie of (moviesData.results || []).slice(0, 20)) {
        if (!existingTitles.has((movie.title || "").toLowerCase())) {
          results.push({
            type: "movie",
            source: "tmdb",
            tmdb_id: movie.id,
            title: movie.title,
            original_title: movie.original_title,
            overview: movie.overview,
            poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
            release_date: movie.release_date,
            rating: movie.vote_average,
            popularity: movie.popularity,
          });
        }
      }
    }

    // Scan trending TV series from TMDb
    if (scanType === "all" || scanType === "tv") {
      const tvRes = await fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}&language=${language}`);
      const tvData = await tvRes.json();

      const { data: existingSeries } = await supabase
        .from("series")
        .select("title")
        .limit(1000);
      const existingSeriesTitles = new Set((existingSeries || []).map((s: any) => s.title.toLowerCase()));

      for (const show of (tvData.results || []).slice(0, 20)) {
        if (!existingSeriesTitles.has((show.name || "").toLowerCase())) {
          results.push({
            type: "series",
            source: "tmdb",
            tmdb_id: show.id,
            title: show.name,
            original_title: show.original_name,
            overview: show.overview,
            poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
            backdrop_url: show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : null,
            release_date: show.first_air_date,
            rating: show.vote_average,
            popularity: show.popularity,
          });
        }
      }
    }

    // Scan popular anime from TMDb
    if (scanType === "all" || scanType === "anime") {
      const animeRes = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=${language}&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1`);
      const animeData = await animeRes.json();

      const { data: existingAnime } = await supabase
        .from("anime")
        .select("title")
        .limit(1000);
      const existingAnimeTitles = new Set((existingAnime || []).map((a: any) => a.title.toLowerCase()));

      for (const anime of (animeData.results || []).slice(0, 20)) {
        if (!existingAnimeTitles.has((anime.name || "").toLowerCase())) {
          results.push({
            type: "anime",
            source: "tmdb",
            tmdb_id: anime.id,
            title: anime.name,
            original_title: anime.original_name,
            overview: anime.overview,
            poster_url: anime.poster_path ? `https://image.tmdb.org/t/p/w500${anime.poster_path}` : null,
            backdrop_url: anime.backdrop_path ? `https://image.tmdb.org/t/p/original${anime.backdrop_path}` : null,
            release_date: anime.first_air_date,
            rating: anime.vote_average,
            popularity: anime.popularity,
          });
        }
      }
    }

    // Scan RSS-aggregated content for anime/entertainment discoveries
    if (scanType === "all" || scanType === "rss") {
      const animeCats = ["anime", "Anime"];
      const entertainmentCats = ["Entertainment", "entertainment"];

      const [animeRss, entertainmentRss] = await Promise.all([
        supabase
          .from("sports_news")
          .select("id, title, title_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at")
          .eq("status", "published")
          .in("category", animeCats)
          .order("published_at", { ascending: false })
          .limit(20),
        supabase
          .from("sports_news")
          .select("id, title, title_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at")
          .eq("status", "published")
          .in("category", entertainmentCats)
          .order("published_at", { ascending: false })
          .limit(20),
      ]);

      (animeRss.data || []).forEach((item: any) => {
        results.push({
          type: "anime_news",
          source: "rss",
          title: item.title,
          title_ar: item.title_ar,
          overview: item.excerpt,
          overview_ar: item.excerpt_ar,
          poster_url: item.image_url,
          source_url: item.source_url,
          source_name: item.source_name,
          published_at: item.published_at,
          tags: item.tags,
        });
      });

      (entertainmentRss.data || []).forEach((item: any) => {
        results.push({
          type: "movie_news",
          source: "rss",
          title: item.title,
          title_ar: item.title_ar,
          overview: item.excerpt,
          overview_ar: item.excerpt_ar,
          poster_url: item.image_url,
          source_url: item.source_url,
          source_name: item.source_name,
          published_at: item.published_at,
          tags: item.tags,
        });
      });
    }

    // Sort: TMDb by popularity, RSS by date
    results.sort((a, b) => {
      if (a.source === "tmdb" && b.source === "tmdb") return (b.popularity || 0) - (a.popularity || 0);
      if (a.source === "rss" && b.source === "rss") return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
      return a.source === "tmdb" ? -1 : 1; // TMDb first
    });

    return new Response(JSON.stringify({ suggestions: results, count: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-content-scanner error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
