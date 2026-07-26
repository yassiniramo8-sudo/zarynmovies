import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANIME_KEYWORDS = [
  "anime", "manga", "otaku", "shonen", "shojo", "seinen", "isekai", "mecha",
  "naruto", "one piece", "dragon ball", "attack on titan", "demon slayer",
  "jujutsu", "my hero academia", "bleach", "hunter x hunter", "tokyo ghoul",
  "studio ghibli", "mappa", "ufotable", "wit studio", "crunchyroll",
  "انمي", "مانجا", "أنمي", "ناروتو", "ون بيس", "دراغون بول",
];

function classifyContent(title: string, overview: string, genres: string[], sourceCategory?: string): "anime" | "movie" | "series" {
  const text = `${title} ${overview} ${(genres || []).join(" ")} ${sourceCategory || ""}`.toLowerCase();
  if (sourceCategory?.toLowerCase() === "anime") return "anime";
  for (const kw of ANIME_KEYWORDS) { if (text.includes(kw)) return "anime"; }
  if (genres?.some(g => g.toLowerCase() === "animation") && text.match(/japan|日本|東京/i)) return "anime";
  if (text.match(/season|episode|series|tv|الموسم|الحلقة|مسلسل/i)) return "series";
  return "movie";
}

async function translateText(text: string, targetLang: string, apiKey: string): Promise<string> {
  if (!text || !apiKey) return "";
  try {
    const langName = targetLang === "ar" ? "Arabic" : "English";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `Translate the following text to ${langName}. Return ONLY the translation, nothing else.` },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch { return ""; }
}

// ─── FREE API HELPERS (no keys needed) ───────────────────────

async function searchJikan(query: string, limit = 15): Promise<any[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=${limit}&sfw=true`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((a: any) => ({
      source: "jikan", source_label: "MyAnimeList", content_type: "anime" as const,
      mal_id: a.mal_id,
      title: a.title_english || a.title,
      title_ar: null,
      overview: a.synopsis?.substring(0, 300) || null,
      poster_url: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
      year: a.aired?.prop?.from?.year?.toString() || a.year?.toString() || null,
      rating: a.score || 0,
      popularity: a.members || 0,
      genres: (a.genres || []).map((g: any) => g.name),
      episodes: a.episodes,
      status: a.status,
      link: a.url,
    }));
  } catch (e) { console.error("Jikan error:", e); return []; }
}

async function searchAniList(query: string, limit = 15): Promise<any[]> {
  try {
    const gql = {
      query: `query($search:String,$perPage:Int){Page(perPage:$perPage){media(search:$search,type:ANIME,sort:POPULARITY_DESC){id title{romaji english native}description(asHtml:false)coverImage{large extraLarge}bannerImage startDate{year}averageScore popularity genres episodes status siteUrl}}}`,
      variables: { search: query, perPage: limit },
    };
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gql),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.Page?.media || []).map((a: any) => ({
      source: "anilist", source_label: "AniList", content_type: "anime" as const,
      anilist_id: a.id,
      title: a.title?.english || a.title?.romaji || "",
      title_ar: null,
      overview: a.description?.replace(/<[^>]*>/g, "")?.substring(0, 300) || null,
      poster_url: a.coverImage?.extraLarge || a.coverImage?.large || null,
      backdrop_url: a.bannerImage || null,
      year: a.startDate?.year?.toString() || null,
      rating: a.averageScore ? a.averageScore / 10 : 0,
      popularity: a.popularity || 0,
      genres: a.genres || [],
      episodes: a.episodes,
      status: a.status,
      link: a.siteUrl,
    }));
  } catch (e) { console.error("AniList error:", e); return []; }
}

async function searchKitsu(query: string, limit = 15): Promise<any[]> {
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=${limit}&sort=-userCount`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((a: any) => {
      const attr = a.attributes;
      return {
        source: "kitsu", source_label: "Kitsu", content_type: "anime" as const,
        kitsu_id: a.id,
        title: attr.titles?.en || attr.titles?.en_jp || attr.canonicalTitle || "",
        title_ar: attr.titles?.ar || null,
        overview: attr.synopsis?.substring(0, 300) || null,
        poster_url: attr.posterImage?.large || attr.posterImage?.original || null,
        year: attr.startDate?.substring(0, 4) || null,
        rating: attr.averageRating ? parseFloat(attr.averageRating) / 10 : 0,
        popularity: attr.userCount || 0,
        genres: [],
        episodes: attr.episodeCount,
        status: attr.status,
        link: `https://kitsu.io/anime/${attr.slug}`,
      };
    });
  } catch (e) { console.error("Kitsu error:", e); return []; }
}

async function browseJikanTop(limit = 15): Promise<any[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/top/anime?limit=${limit}&filter=airing`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((a: any) => ({
      source: "jikan", source_label: "MyAnimeList", content_type: "anime" as const,
      mal_id: a.mal_id,
      title: a.title_english || a.title,
      overview: a.synopsis?.substring(0, 300) || null,
      poster_url: a.images?.jpg?.large_image_url || null,
      year: a.aired?.prop?.from?.year?.toString() || null,
      rating: a.score || 0,
      popularity: a.members || 0,
      genres: (a.genres || []).map((g: any) => g.name),
      link: a.url,
    }));
  } catch { return []; }
}

async function browseAniListTrending(limit = 15): Promise<any[]> {
  try {
    const gql = {
      query: `query($perPage:Int){Page(perPage:$perPage){media(type:ANIME,sort:TRENDING_DESC,status:RELEASING){id title{romaji english}coverImage{large extraLarge}bannerImage startDate{year}averageScore popularity genres siteUrl}}}`,
      variables: { perPage: limit },
    };
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gql),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.Page?.media || []).map((a: any) => ({
      source: "anilist", source_label: "AniList", content_type: "anime" as const,
      anilist_id: a.id,
      title: a.title?.english || a.title?.romaji || "",
      poster_url: a.coverImage?.extraLarge || a.coverImage?.large || null,
      backdrop_url: a.bannerImage || null,
      year: a.startDate?.year?.toString() || null,
      rating: a.averageScore ? a.averageScore / 10 : 0,
      popularity: a.popularity || 0,
      genres: a.genres || [],
      link: a.siteUrl,
    }));
  } catch { return []; }
}

// ─── Deduplication helper ────────────────────────────────────
function deduplicateItems(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter((item: any) => {
    const key = (item.title || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, query, category, page, limit: reqLimit, preferred_source } = body;
    const TMDB_API_KEY_ENV = Deno.env.get("TMDB_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const limit = reqLimit || 40;

    // Fetch user-configured API keys
    const { data: userKeys } = await supabase
      .from("entertainment_api_keys")
      .select("source_name, api_key, auto_use")
      .eq("is_active", true);

    const apiKeys: Record<string, string> = {};
    (userKeys || []).forEach((k: any) => { apiKeys[k.source_name] = k.api_key; });

    const getKey = (source: string, envFallback?: string): string | null => {
      if (preferred_source === source && apiKeys[source]) return apiKeys[source];
      if (apiKeys[source]) return apiKeys[source];
      return envFallback || null;
    };

    const TMDB_API_KEY = getKey("tmdb", TMDB_API_KEY_ENV);
    const YOUTUBE_API_KEY = getKey("youtube", Deno.env.get("YOUTUBE_API_KEY"));
    const OMDB_API_KEY = getKey("omdb");

    // ─── ACTION: browse ───────────────────────────────────────
    if (action === "browse") {
      const tmdbPage = page || 1;
      const promises: Promise<any[]>[] = [];

      // TMDb trending (if key available)
      if (TMDB_API_KEY) {
        if (!category || category === "movie") {
          promises.push(
            fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=en-US&page=${tmdbPage}`)
              .then(r => r.json()).then(d => (d.results || []).map((m: any) => ({
                source: "tmdb", source_label: "TMDB", content_type: "movie", tmdb_id: m.id,
                title: m.title, poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                backdrop_url: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : null,
                year: m.release_date?.substring(0, 4) || null,
                rating: m.vote_average, popularity: m.popularity, genres: m.genre_ids, release_date: m.release_date,
              }))).catch(() => [])
          );
        }
        if (!category || category === "series") {
          promises.push(
            fetch(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}&language=en-US&page=${tmdbPage}`)
              .then(r => r.json()).then(d => (d.results || []).map((s: any) => ({
                source: "tmdb", source_label: "TMDB", content_type: "series", tmdb_id: s.id,
                title: s.name, poster_url: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
                backdrop_url: s.backdrop_path ? `https://image.tmdb.org/t/p/original${s.backdrop_path}` : null,
                year: s.first_air_date?.substring(0, 4) || null,
                rating: s.vote_average, popularity: s.popularity, genres: s.genre_ids, release_date: s.first_air_date,
              }))).catch(() => [])
          );
        }
        if (!category || category === "anime") {
          promises.push(
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&language=en-US&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${tmdbPage}`)
              .then(r => r.json()).then(d => (d.results || []).map((a: any) => ({
                source: "tmdb", source_label: "TMDB", content_type: "anime", tmdb_id: a.id,
                title: a.name, poster_url: a.poster_path ? `https://image.tmdb.org/t/p/w500${a.poster_path}` : null,
                backdrop_url: a.backdrop_path ? `https://image.tmdb.org/t/p/original${a.backdrop_path}` : null,
                year: a.first_air_date?.substring(0, 4) || null,
                rating: a.vote_average, popularity: a.popularity, genres: a.genre_ids, release_date: a.first_air_date,
              }))).catch(() => [])
          );
        }
      }

      // Free anime APIs (no keys needed)
      if (!category || category === "anime") {
        promises.push(browseJikanTop(15));
        promises.push(browseAniListTrending(15));
      }

      // RSS aggregated content
      const rssCatMap: Record<string, string[]> = {
        anime: ["anime", "Anime"],
        movie: ["Entertainment", "entertainment"],
        series: ["Entertainment", "entertainment"],
      };
      let rssQuery = supabase
        .from("sports_news")
        .select("id, title, title_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(limit);
      if (category && rssCatMap[category]) {
        rssQuery = rssQuery.in("category", rssCatMap[category]);
      } else {
        rssQuery = rssQuery.in("category", ["anime", "Anime", "Entertainment", "entertainment"]);
      }
      promises.push(rssQuery.then(({ data }: any) => (data || []).map((item: any) => ({
        source: "rss", source_label: item.source_name || "RSS", content_type: classifyContent(item.title, item.excerpt || "", [], item.category),
        id: item.id, title: item.title, title_ar: item.title_ar,
        overview: item.excerpt, overview_ar: item.excerpt_ar,
        poster_url: item.image_url, link: item.source_url,
        source_name: item.source_name, tags: item.tags, published_at: item.published_at,
      }))));

      // Local DB content
      if (!category || category === "movie") {
        promises.push(supabase.from("movies").select("id, title, description, poster_url, genre, year, rating, trending").order("created_at", { ascending: false }).limit(20).then(({ data }: any) => (data || []).map((m: any) => ({ ...m, source: "local", source_label: "Library", content_type: "movie" }))));
      }
      if (!category || category === "anime") {
        promises.push(supabase.from("anime").select("id, title, description, poster_url, genre, year, rating, trending").order("created_at", { ascending: false }).limit(20).then(({ data }: any) => (data || []).map((a: any) => ({ ...a, source: "local", source_label: "Library", content_type: "anime" }))));
      }
      if (!category || category === "series") {
        promises.push(supabase.from("series").select("id, title, description, poster_url, genre, year, rating, trending").order("created_at", { ascending: false }).limit(20).then(({ data }: any) => (data || []).map((s: any) => ({ ...s, source: "local", source_label: "Library", content_type: "series" }))));
      }

      const allResults = await Promise.all(promises);
      let items = deduplicateItems(allResults.flat());

      items.sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0) || new Date(b.release_date || b.published_at || 0).getTime() - new Date(a.release_date || a.published_at || 0).getTime());

      return new Response(JSON.stringify({ items: items.slice(0, limit), total: items.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: search ───────────────────────────────────────
    if (action === "search") {
      if (!query) throw new Error("Query is required");

      const searchPromises: Promise<any[]>[] = [];

      // TMDb multi-search
      if (TMDB_API_KEY) {
        searchPromises.push(
          fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`)
            .then(r => r.json())
            .then(tmdbRes => (tmdbRes.results || [])
              .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
              .slice(0, 15)
              .map((r: any) => {
                const ct = classifyContent(r.title || r.name || "", r.overview || "", [], r.media_type === "tv" ? "series" : "movie");
                return {
                  source: "tmdb", source_label: "TMDB", content_type: ct, tmdb_id: r.id,
                  title: r.title || r.name, overview: r.overview,
                  poster_url: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
                  backdrop_url: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : null,
                  year: (r.release_date || r.first_air_date)?.substring(0, 4) || null,
                  rating: r.vote_average, popularity: r.popularity,
                  release_date: r.release_date || r.first_air_date,
                };
              }))
            .catch(() => [])
        );
      }

      // Free anime APIs - parallel search
      searchPromises.push(searchJikan(query, 10));
      searchPromises.push(searchAniList(query, 10));
      searchPromises.push(searchKitsu(query, 10));

      // RSS search
      searchPromises.push(
        supabase.from("sports_news")
          .select("id, title, title_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at")
          .or(`title.ilike.%${query}%,title_ar.ilike.%${query}%,tags.cs.{${query}}`)
          .eq("status", "published")
          .in("category", ["anime", "Anime", "Entertainment", "entertainment"])
          .order("published_at", { ascending: false })
          .limit(20)
          .then(({ data }: any) => (data || []).map((item: any) => ({
            source: "rss", source_label: item.source_name || "RSS", content_type: classifyContent(item.title, item.excerpt || "", [], item.category),
            id: item.id, title: item.title, title_ar: item.title_ar,
            overview: item.excerpt, overview_ar: item.excerpt_ar,
            poster_url: item.image_url, link: item.source_url,
            source_name: item.source_name, tags: item.tags,
          })))
      );

      // Local DB search
      searchPromises.push(
        Promise.all([
          supabase.from("movies").select("id, title, description, poster_url, genre, year, rating").ilike("title", `%${query}%`).limit(10),
          supabase.from("anime").select("id, title, description, poster_url, genre, year, rating").ilike("title", `%${query}%`).limit(10),
          supabase.from("series").select("id, title, description, poster_url, genre, year, rating").ilike("title", `%${query}%`).limit(10),
        ]).then(([moviesR, animeR, seriesR]) => [
          ...(moviesR.data || []).map((m: any) => ({ ...m, source: "local", source_label: "Library", content_type: "movie" })),
          ...(animeR.data || []).map((a: any) => ({ ...a, source: "local", source_label: "Library", content_type: "anime" })),
          ...(seriesR.data || []).map((s: any) => ({ ...s, source: "local", source_label: "Library", content_type: "series" })),
        ])
      );

      const allResults = await Promise.all(searchPromises);
      let all = deduplicateItems(allResults.flat());

      if (category) {
        all = all.filter((item: any) => item.content_type === category);
      }

      // Sort: local first, then by popularity
      all.sort((a: any, b: any) => {
        if (a.source === "local" && b.source !== "local") return -1;
        if (b.source === "local" && a.source !== "local") return 1;
        return (b.popularity || 0) - (a.popularity || 0);
      });

      return new Response(JSON.stringify({ items: all, total: all.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: enrich ───────────────────────────────────────
    if (action === "enrich") {
      const tmdbId = body.tmdb_id;
      const mediaType = body.media_type || "movie";

      // If no tmdb_id, try to find it via search (for Jikan/AniList/Kitsu items)
      let resolvedTmdbId = tmdbId;
      if (!resolvedTmdbId && body.title && TMDB_API_KEY) {
        try {
          const searchType = body.content_type === "movie" ? "movie" : "tv";
          const sr = await fetch(`https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(body.title)}&page=1`);
          const sd = await sr.json();
          if (sd.results?.[0]) resolvedTmdbId = sd.results[0].id;
        } catch {}
      }

      // If we still have no tmdb_id, return basic enriched data from what we have
      if (!resolvedTmdbId) {
        let titleAr = body.title_ar || "";
        let overviewAr = body.overview_ar || "";
        if (LOVABLE_API_KEY && !titleAr && body.title) {
          [titleAr, overviewAr] = await Promise.all([
            translateText(body.title, "ar", LOVABLE_API_KEY),
            translateText(body.overview || "", "ar", LOVABLE_API_KEY),
          ]);
        }
        return new Response(JSON.stringify({
          item: { ...body, title_ar: titleAr, overview_ar: overviewAr },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const resolvedMediaType = body.content_type === "movie" ? "movie" : "tv";

      const [detailsRes, creditsRes, videosRes, imagesRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/${resolvedMediaType}/${resolvedTmdbId}?api_key=${TMDB_API_KEY}&language=en-US`),
        fetch(`https://api.themoviedb.org/3/${resolvedMediaType}/${resolvedTmdbId}/credits?api_key=${TMDB_API_KEY}&language=en-US`),
        fetch(`https://api.themoviedb.org/3/${resolvedMediaType}/${resolvedTmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`),
        fetch(`https://api.themoviedb.org/3/${resolvedMediaType}/${resolvedTmdbId}/images?api_key=${TMDB_API_KEY}`),
      ]);
      const [details, credits, videos, images] = await Promise.all([
        detailsRes.json(), creditsRes.json(), videosRes.json(), imagesRes.json(),
      ]);

      const trailer = (videos.results || []).find((v: any) => v.type === "Trailer" && v.site === "YouTube");
      const teaser = (videos.results || []).find((v: any) => v.type === "Teaser" && v.site === "YouTube");
      const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : teaser ? `https://www.youtube.com/watch?v=${teaser.key}` : null;

      const cast = (credits.cast || []).slice(0, 10).map((c: any) => ({
        name: c.name, character: c.character,
        profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      }));

      const galleryImages = [
        ...(images.backdrops || []).slice(0, 6).map((i: any) => `https://image.tmdb.org/t/p/original${i.file_path}`),
        ...(images.posters || []).slice(0, 4).map((i: any) => `https://image.tmdb.org/t/p/w500${i.file_path}`),
      ];

      const genres = (details.genres || []).map((g: any) => g.name);
      const contentType = classifyContent(details.title || details.name || "", details.overview || "", genres);

      // Translate title + overview to Arabic
      let titleAr = "";
      let overviewAr = "";
      if (LOVABLE_API_KEY) {
        [titleAr, overviewAr] = await Promise.all([
          translateText(details.title || details.name || "", "ar", LOVABLE_API_KEY),
          translateText(details.overview || "", "ar", LOVABLE_API_KEY),
        ]);
      }

      // Generate SEO via AI
      let seo: any = {};
      if (LOVABLE_API_KEY) {
        try {
          const seoRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "Generate SEO metadata. Return ONLY valid JSON." },
                { role: "user", content: `Title: ${details.title || details.name}\nGenres: ${genres.join(", ")}\nYear: ${details.release_date || details.first_air_date}\nOverview: ${(details.overview || "").substring(0, 200)}\n\nGenerate: {"seo_title": "<60 chars>", "seo_description": "<160 chars>", "tags": ["tag1","tag2",...8 tags], "seo_title_ar": "<Arabic SEO title>", "seo_description_ar": "<Arabic meta description>"}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "generate_seo",
                  description: "Generate SEO metadata for entertainment content",
                  parameters: {
                    type: "object",
                    properties: {
                      seo_title: { type: "string" },
                      seo_description: { type: "string" },
                      tags: { type: "array", items: { type: "string" } },
                      seo_title_ar: { type: "string" },
                      seo_description_ar: { type: "string" },
                    },
                    required: ["seo_title", "seo_description", "tags"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "generate_seo" } },
            }),
          });
          if (seoRes.ok) {
            const seoData = await seoRes.json();
            const toolCall = seoData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              seo = JSON.parse(toolCall.function.arguments);
            }
          }
        } catch (e) { console.error("SEO generation error:", e); }
      }

      const enriched: any = {
        tmdb_id: resolvedTmdbId,
        content_type: contentType,
        media_type: resolvedMediaType,
        title: details.title || details.name,
        title_ar: titleAr,
        original_title: details.original_title || details.original_name,
        overview: details.overview,
        overview_ar: overviewAr,
        poster_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
        backdrop_url: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
        trailer_url: trailerUrl,
        year: (details.release_date || details.first_air_date)?.substring(0, 4) || null,
        rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : 0,
        genres,
        runtime: details.runtime || null,
        tagline: details.tagline || null,
        cast,
        gallery_images: galleryImages,
        number_of_seasons: details.number_of_seasons || null,
        number_of_episodes: details.number_of_episodes || null,
        status: details.status,
        ...seo,
      };

      // Enrich with OMDb data
      if (OMDB_API_KEY && enriched.title) {
        try {
          const omdbRes = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(enriched.title)}&apikey=${OMDB_API_KEY}`);
          const omdb = await omdbRes.json();
          if (omdb.Response === "True") {
            enriched.imdb_rating = omdb.imdbRating || null;
            enriched.imdb_id = omdb.imdbID || null;
            enriched.awards = omdb.Awards || null;
            enriched.box_office = omdb.BoxOffice || null;
            enriched.director = omdb.Director || null;
            enriched.writer = omdb.Writer || null;
          }
        } catch (e) { console.error("OMDb enrichment error:", e); }
      }

      // YouTube trailer fallback
      if (!enriched.trailer_url && YOUTUBE_API_KEY && enriched.title) {
        try {
          const ytQuery = `${enriched.title} ${enriched.year || ""} official trailer`;
          const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(ytQuery)}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`);
          const ytData = await ytRes.json();
          if (ytData.items?.length > 0) {
            enriched.trailer_url = `https://www.youtube.com/watch?v=${ytData.items[0].id.videoId}`;
          }
        } catch (e) { console.error("YouTube trailer search error:", e); }
      }

      return new Response(JSON.stringify({ item: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: import_to_library ────────────────────────────
    // Save enriched content to the appropriate table (anime, movies, series)
    if (action === "import_to_library") {
      const item = body.item;
      if (!item || !item.title) throw new Error("Item with title is required");

      const ct = item.content_type || "movie";
      const table = ct === "anime" ? "anime" : ct === "series" ? "series" : "movies";

      const record: any = {
        title: item.title,
        description: item.overview || item.overview_ar || null,
        poster_url: item.poster_url || null,
        genre: item.genres || [],
        year: item.year ? parseInt(item.year) : null,
        rating: item.rating || 0,
        trailer_url: item.trailer_url || null,
        gallery_images: item.gallery_images || [],
      };

      const { data: inserted, error } = await supabase.from(table).insert(record).select().single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, item: inserted, table }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: verify_key ───────────────────────────────────
    if (action === "verify_key") {
      const { source_name, api_key: keyToVerify } = body;
      if (!source_name || !keyToVerify) throw new Error("source_name and api_key are required");

      let valid = false;
      let message = "Unknown source — cannot verify automatically";
      let details: any = null;

      try {
        if (source_name === "tmdb") {
          const r = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${keyToVerify}`);
          const d = await r.json();
          if (r.ok && d.images) { valid = true; message = "TMDB key is valid ✅"; }
          else { message = d.status_message || "Invalid TMDB API key ❌"; }
        } else if (source_name === "youtube") {
          const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${keyToVerify}`);
          const d = await r.json();
          if (r.ok && d.items) { valid = true; message = "YouTube key is valid ✅"; }
          else { message = d.error?.message || "Invalid YouTube API key ❌"; }
        } else if (source_name === "omdb") {
          const r = await fetch(`https://www.omdbapi.com/?t=Inception&apikey=${keyToVerify}`);
          const d = await r.json();
          if (d.Response === "True") { valid = true; message = "OMDb key is valid ✅"; }
          else { message = d.Error || "Invalid OMDb API key ❌"; }
        } else if (source_name === "jikan") {
          const r = await fetch(`https://api.jikan.moe/v4/anime/1`);
          const d = await r.json();
          if (r.ok && d.data) { valid = true; message = "Jikan API is accessible ✅ (no key required)"; }
          else { message = "Jikan API is currently unreachable ❌"; }
        } else if (source_name === "fanart") {
          const r = await fetch(`https://webservice.fanart.tv/v3/movies/tt0120737?api_key=${keyToVerify}`);
          if (r.ok) { valid = true; message = "FanArt.tv key is valid ✅"; }
          else { message = "Invalid FanArt.tv API key ❌"; }
          await r.text();
        } else if (source_name === "tvdb") {
          const r = await fetch(`https://api4.thetvdb.com/v4/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apikey: keyToVerify }),
          });
          const d = await r.json();
          if (r.ok && d.data?.token) { valid = true; message = "TheTVDB key is valid ✅"; }
          else { message = d.message || "Invalid TheTVDB API key ❌"; }
        } else {
          message = `Cannot auto-verify "${source_name}" — key saved but not tested`;
          details = { note: "Manual verification recommended" };
        }
      } catch (e) {
        message = `Verification failed: ${e instanceof Error ? e.message : "Network error"} ❌`;
      }

      return new Response(JSON.stringify({ valid, message, details }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: list_keys ───────────────────────────────────
    if (action === "list_keys") {
      const sources = (userKeys || []).map((k: any) => ({
        source_name: k.source_name,
        auto_use: k.auto_use,
      }));
      return new Response(JSON.stringify({ sources, available_keys: Object.keys(apiKeys) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: browse, search, enrich, import_to_library, verify_key, list_keys" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("entertainment-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
