import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TMDB_LANG_MAP: Record<string, string> = {
  en: "en-US", ar: "ar-SA", fr: "fr-FR", es: "es-ES",
  tr: "tr-TR", de: "de-DE", ja: "ja-JP", ko: "ko-KR",
  pt: "pt-BR", hi: "hi-IN",
};

const LANG_NAMES: Record<string, string> = {
  en: "English", ar: "Arabic", fr: "French", es: "Spanish",
  tr: "Turkish", de: "German", ja: "Japanese", ko: "Korean",
  pt: "Portuguese", hi: "Hindi",
};

// Search RSS-aggregated content from sports_news table
async function searchRSSContent(supabase: any, query: string, category?: string) {
  const searchTerm = `%${query}%`;
  let q = supabase
    .from("sports_news")
    .select("id, title, title_ar, content, content_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at, status")
    .or(`title.ilike.${searchTerm},title_ar.ilike.${searchTerm},content.ilike.${searchTerm},content_ar.ilike.${searchTerm},tags.cs.{${query}}`)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  if (category) {
    const catMap: Record<string, string[]> = {
      anime: ["anime", "Anime"],
      movies: ["Entertainment", "entertainment"],
      all: [],
    };
    const cats = catMap[category] || [];
    if (cats.length > 0) {
      q = q.in("category", cats);
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error("RSS search error:", error);
    return [];
  }
  return (data || []).map((item: any) => ({
    source: "rss",
    id: item.id,
    title: item.title,
    title_ar: item.title_ar,
    description: item.excerpt || item.content?.substring(0, 300),
    description_ar: item.excerpt_ar || item.content_ar?.substring(0, 300),
    image_url: item.image_url,
    link: item.source_url,
    source_name: item.source_name,
    category: item.category,
    tags: item.tags,
    published_at: item.published_at,
  }));
}

// Search local DB content (movies, anime, series)
async function searchLocalContent(supabase: any, query: string) {
  const searchTerm = `%${query}%`;
  const [moviesRes, animeRes, seriesRes] = await Promise.all([
    supabase.from("movies").select("id, title, description, poster_url, genre, year, rating, trending").ilike("title", searchTerm).limit(10),
    supabase.from("anime").select("id, title, description, poster_url, genre, year, rating, trending").ilike("title", searchTerm).limit(10),
    supabase.from("series").select("id, title, description, poster_url, genre, year, rating, trending").ilike("title", searchTerm).limit(10),
  ]);

  const results: any[] = [];
  (moviesRes.data || []).forEach((m: any) => results.push({ ...m, content_type: "movie", source: "local" }));
  (animeRes.data || []).forEach((a: any) => results.push({ ...a, content_type: "anime", source: "local" }));
  (seriesRes.data || []).forEach((s: any) => results.push({ ...s, content_type: "series", source: "local" }));
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, action, movieData, languages, primaryLanguage, category } = body;
    const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const lang = primaryLanguage || "en";
    const tmdbLang = TMDB_LANG_MAP[lang] || "en-US";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!TMDB_API_KEY) {
      return new Response(JSON.stringify({ error: "TMDb API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: unified search (TMDb + RSS + Local DB)
    if (action === "search") {
      // Run all searches in parallel
      const [tmdbResults, rssResults, localResults] = await Promise.all([
        (async () => {
          const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=${tmdbLang}&page=1`;
          const searchRes = await fetch(searchUrl);
          const searchData = await searchRes.json();
          return (searchData.results || [])
            .filter((r: any) => r.media_type === "movie" || r.media_type === "tv")
            .slice(0, 10)
            .map((r: any) => ({
              source: "tmdb",
              tmdb_id: r.id,
              title: r.title || r.name,
              original_title: r.original_title || r.original_name,
              media_type: r.media_type,
              overview: r.overview,
              poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
              backdrop_path: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : null,
              release_date: r.release_date || r.first_air_date,
              vote_average: r.vote_average,
              popularity: r.popularity,
              genre_ids: r.genre_ids,
            }));
        })(),
        searchRSSContent(supabase, query, category),
        searchLocalContent(supabase, query),
      ]);

      return new Response(JSON.stringify({
        results: tmdbResults,
        rss_results: rssResults,
        local_results: localResults,
        total: tmdbResults.length + rssResults.length + localResults.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: RSS-only search (for content discovery)
    if (action === "rss_search") {
      const rssResults = await searchRSSContent(supabase, query, category);
      return new Response(JSON.stringify({ results: rssResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: browse RSS content by category
    if (action === "rss_browse") {
      const feedCategory = category || "all";
      const limit = body.limit || 30;

      let q = supabase
        .from("sports_news")
        .select("id, title, title_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(limit);

      const catMap: Record<string, string[]> = {
        anime: ["anime", "Anime"],
        movies: ["Entertainment", "entertainment"],
        tech: ["Technology"],
        sports: ["Sports"],
        news: ["Sports", "Politics", "Economy", "Health", "Science", "Culture", "General"],
      };

      if (feedCategory !== "all" && catMap[feedCategory]) {
        q = q.in("category", catMap[feedCategory]);
      }

      const { data, error } = await q;
      if (error) throw error;

      return new Response(JSON.stringify({ items: data || [], count: (data || []).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch full details (in selected language)
    if (action === "details") {
      const id = body.movieData?.tmdb_id || body.tmdb_id;
      const type = body.movieData?.media_type || body.media_type || "movie";

      const [detailsRes, creditsRes, videosRes, imagesRes, providersRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&language=${tmdbLang}`),
        fetch(`https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${TMDB_API_KEY}&language=${tmdbLang}`),
        fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${TMDB_API_KEY}&language=${tmdbLang}`),
        fetch(`https://api.themoviedb.org/3/${type}/${id}/images?api_key=${TMDB_API_KEY}`),
        fetch(`https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`),
      ]);

      const [details, credits, videos, images, providersData] = await Promise.all([
        detailsRes.json(), creditsRes.json(), videosRes.json(), imagesRes.json(), providersRes.json(),
      ]);

      let videoResults = videos.results || [];
      if (videoResults.length === 0 && lang !== "en") {
        const fallbackVids = await fetch(`https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
        const fallbackData = await fallbackVids.json();
        videoResults = fallbackData.results || [];
      }

      const providerRegion = providersData.results?.US || providersData.results?.[Object.keys(providersData.results || {})[0]] || {};
      const mapProviders = (list: any[]) => (list || []).map((p: any) => ({
        name: p.provider_name,
        logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
      }));

      const trailer = videoResults.find((v: any) => v.type === "Trailer" && v.site === "YouTube");
      const teaser = videoResults.find((v: any) => v.type === "Teaser" && v.site === "YouTube");
      const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : teaser ? `https://www.youtube.com/watch?v=${teaser.key}` : null;

      const cast = (credits.cast || []).slice(0, 10).map((c: any) => ({
        name: c.name,
        character: c.character,
        profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      }));

      const galleryImages = [
        ...(images.backdrops || []).slice(0, 4).map((i: any) => `https://image.tmdb.org/t/p/original${i.file_path}`),
        ...(images.posters || []).slice(0, 4).map((i: any) => `https://image.tmdb.org/t/p/w500${i.file_path}`),
      ];

      const result = {
        tmdb_id: id,
        media_type: type,
        title: details.title || details.name,
        original_title: details.original_title || details.original_name,
        overview: details.overview,
        poster_url: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
        backdrop_url: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
        trailer_url: trailerUrl,
        year: details.release_date ? parseInt(details.release_date.substring(0, 4)) : details.first_air_date ? parseInt(details.first_air_date.substring(0, 4)) : null,
        rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : 0,
        popularity: details.popularity,
        genres: (details.genres || []).map((g: any) => g.name),
        runtime: details.runtime || null,
        tagline: details.tagline || null,
        cast,
        gallery_images: galleryImages,
        number_of_seasons: details.number_of_seasons || null,
        number_of_episodes: details.number_of_episodes || null,
        status: details.status,
        watch_providers: {
          link: providerRegion.link || null,
          flatrate: mapProviders(providerRegion.flatrate),
          rent: mapProviders(providerRegion.rent),
          buy: mapProviders(providerRegion.buy),
        },
      };

      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate AI description + translations
    if (action === "generate") {
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const primaryLang = primaryLanguage || "en";
      const primaryLangName = LANG_NAMES[primaryLang] || "English";
      const targetLanguages = (languages || ["en", "ar", "fr", "es"]).filter((l: string) => l !== primaryLang);

      const prompt = `You are a movie/series content writer for a streaming platform called "Zaryn Movies".

Given this movie/series data:
Title: ${movieData.title}
Original Title: ${movieData.original_title || movieData.title}
Original Overview: ${movieData.overview || "No overview available"}
Genres: ${(movieData.genres || []).join(", ")}
Year: ${movieData.year || "Unknown"}
Rating: ${movieData.rating || "N/A"}/10
Runtime: ${movieData.runtime ? movieData.runtime + " minutes" : "Unknown"}
Cast: ${(movieData.cast || []).map((c: any) => `${c.name} as ${c.character}`).join(", ")}
Tagline: ${movieData.tagline || "None"}
Status: ${movieData.status || "Unknown"}

PRIMARY LANGUAGE: ${primaryLangName} (${primaryLang})

Generate the following as a JSON object:
1. "description": A cinematic, engaging, SEO-friendly description in ${primaryLangName} (200-300 words). Make it compelling and dramatic. All section headings, labels, and content must be in ${primaryLangName}. Movie titles and actor names can remain in their original form.
2. "tags": An array of 8-12 relevant keyword tags in ${primaryLangName} for SEO.
3. "seo_title": An SEO-optimized page title in ${primaryLangName} (under 60 characters).
4. "seo_description": A meta description in ${primaryLangName} (under 160 characters).
5. "translated_genres": An array of the movie genres translated into ${primaryLangName}.
6. "translated_labels": An object with UI labels translated into ${primaryLangName}: { "overview": "...", "cast": "...", "gallery": "...", "trailer": "...", "details": "...", "release_date": "...", "runtime": "...", "rating": "...", "seasons": "...", "episodes": "...", "watch_now": "...", "download": "...", "similar": "..." }
7. "translations": An object where each key is a language code and the value is the translated description. Translate the primary description to: ${targetLanguages.map((l: string) => `${LANG_NAMES[l] || l} (${l})`).join(", ")}. Keep movie/actor names unchanged.

Return ONLY valid JSON, no markdown formatting.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a professional movie content writer. Always return valid JSON only." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_movie_content",
              description: "Generate movie description, tags, SEO, labels and translations",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Cinematic description in primary language" },
                  tags: { type: "array", items: { type: "string" }, description: "SEO keyword tags in primary language" },
                  seo_title: { type: "string", description: "SEO title in primary language" },
                  seo_description: { type: "string", description: "Meta description in primary language" },
                  translated_genres: { type: "array", items: { type: "string" }, description: "Genres in primary language" },
                  translated_labels: {
                    type: "object",
                    description: "UI labels translated to primary language",
                    additionalProperties: { type: "string" }
                  },
                  translations: {
                    type: "object",
                    description: "Descriptions in other languages",
                    additionalProperties: { type: "string" }
                  },
                },
                required: ["description", "tags", "seo_title", "seo_description", "translated_genres", "translated_labels", "translations"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "generate_movie_content" } },
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds in workspace settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let generated;
      if (toolCall?.function?.arguments) {
        generated = JSON.parse(toolCall.function.arguments);
      } else {
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        generated = jsonMatch ? JSON.parse(jsonMatch[0]) : { description: content, tags: [], translations: {} };
      }

      return new Response(JSON.stringify({ generated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-movie-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
