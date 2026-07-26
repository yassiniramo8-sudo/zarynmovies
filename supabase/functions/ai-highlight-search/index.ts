import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query) throw new Error("Query is required");

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YouTube API key not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Step 1: Search YouTube for latest highlights — no date filter, always fresh
    const searchQ = encodeURIComponent(query + " highlights");
    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQ}&type=video&maxResults=10&order=relevance&key=${YOUTUBE_API_KEY}`;

    const ytRes = await fetch(ytUrl);
    if (!ytRes.ok) {
      const err = await ytRes.text();
      console.error("YouTube API error:", err);
      throw new Error("YouTube search failed");
    }
    const ytData = await ytRes.json();
    const videos = ytData.items || [];

    if (videos.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Use AI to generate SEO content, detect language, translate
    const prompt = `You are a multilingual football highlights SEO expert. The admin typed: "${query}"

Detect the input language. Respond with content in the detected language AND provide translations.

For each YouTube video below, generate optimized content:

Videos:
${videos.map((v: any, i: number) => `${i + 1}. Title: "${v.snippet.title}" | Channel: "${v.snippet.channelTitle}" | VideoID: "${v.id.videoId}" | Published: "${v.snippet.publishedAt}"`).join("\n")}

For each video, return a JSON array with objects containing:
- title_en: SEO optimized English title (include teams, league, score if visible)
- title_ar: Arabic translation of the title
- description_en: 2-3 sentence English description
- description_ar: Arabic translation of description
- teams: array of team names extracted (handle typos, alternate spellings)
- match_date: extracted match date in YYYY-MM-DD format from video publish date or title context
- categories: array from [Premier League, La Liga, Champions League, Serie A, Bundesliga, Ligue 1, World Cup, Africa Cup, Botola Pro, Friendly, Europa League, Conference League, Copa America, Euro, Saudi Pro League, MLS]
- tags: array of relevant tags
- seo_title: SEO optimized title under 60 chars
- seo_description: meta description under 160 chars
- seo_keywords: comma-separated keywords
- seo_slug: URL-friendly slug
- youtube_video_id: the video ID
- thumbnail_url: https://img.youtube.com/vi/{videoId}/maxresdefault.jpg
- source_channel: the YouTube channel name
- relevance_score: 1-10 rating of how relevant this video is to the query

Sort by relevance_score descending.
Return ONLY a valid JSON array, no markdown.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || "[]";
    
    // Clean markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let results;
    try {
      results = JSON.parse(content);
      // Sort by relevance_score descending
      results.sort((a: any, b: any) => (b.relevance_score || 0) - (a.relevance_score || 0));
    } catch {
      console.error("Failed to parse AI response:", content);
      results = videos.map((v: any) => ({
        title_en: v.snippet.title,
        title_ar: "",
        description_en: v.snippet.description,
        description_ar: "",
        teams: [],
        match_date: v.snippet.publishedAt?.substring(0, 10) || "",
        categories: [],
        tags: [],
        seo_title: v.snippet.title,
        seo_description: v.snippet.description?.substring(0, 160) || "",
        seo_keywords: "",
        seo_slug: v.snippet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 60),
        youtube_video_id: v.id.videoId,
        thumbnail_url: `https://img.youtube.com/vi/${v.id.videoId}/maxresdefault.jpg`,
        source_channel: v.snippet.channelTitle,
        relevance_score: 5,
      }));
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
