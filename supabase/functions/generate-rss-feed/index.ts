import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildRssXml(title: string, description: string, link: string, items: any[]): string {
  const itemsXml = items.map(item => {
    const titleEn = item.title || "";
    const titleAr = item.title_ar || "";
    const descEn = item.excerpt || item.content?.substring(0, 300) || "";
    const descAr = item.excerpt_ar || item.content_ar?.substring(0, 300) || "";

    // Show both languages if available
    const displayTitle = titleAr ? `${titleEn} | ${titleAr}` : titleEn;
    const displayDesc = descAr ? `${descEn}\n\n${descAr}` : descEn;

    return `
    <item>
      <title>${escapeXml(displayTitle)}</title>
      <link>${escapeXml(item.source_url || item.link || link)}</link>
      <description><![CDATA[${displayDesc}]]></description>
      <pubDate>${new Date(item.published_at || item.created_at).toUTCString()}</pubDate>
      <category>${escapeXml(item.category || "General")}</category>
      ${item.image_url ? `<enclosure url="${escapeXml(item.image_url)}" type="image/jpeg" />` : ""}
      <guid isPermaLink="false">${item.id}</guid>
      ${item.source_name ? `<source>${escapeXml(item.source_name)}</source>` : ""}
      ${item.tags?.length ? item.tags.map((t: string) => `<category>${escapeXml(t)}</category>`).join("") : ""}
    </item>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <description>${escapeXml(description)}</description>
    <link>${escapeXml(link)}</link>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>30</ttl>
    ${itemsXml}
  </channel>
</rss>`;
}

const FEED_FILTERS: Record<string, { categories: string[]; tags?: string[]; title: string; description: string }> = {
  "anime": {
    categories: ["anime", "Anime"],
    tags: ["anime", "manga", "otaku", "crunchyroll", "funimation", "myanimelist", "anilist", "shonen", "shojo", "seinen", "josei", "isekai", "light novel", "livechart", "kitsu", "toei animation", "studio ghibli", "mappa", "ufotable", "madhouse", "bones", "trigger", "kyoto animation", "naruto", "one piece", "dragon ball", "jujutsu", "demon slayer", "attack on titan", "chainsaw man", "spy x family", "bleach", "hunter x hunter", "solo leveling", "أنيمي", "مانجا"],
    title: "ZarynMovies - Anime RSS Feed",
    description: "Latest anime news, trailers, reviews, and updates (EN + AR)",
  },
  "movies-tv": {
    categories: ["Entertainment", "entertainment"],
    tags: ["movie", "film", "cinema", "series", "tv", "television", "netflix", "disney", "hbo", "trailer", "box office", "oscar", "emmy", "golden globe", "streaming", "premiere", "sequel", "remake", "reboot", "marvel", "dc", "pixar", "season", "episode", "drama", "thriller", "horror", "comedy", "action", "sci-fi", "blockbuster", "indie film", "a24", "warner bros", "sony pictures", "universal", "lionsgate", "paramount", "prime video", "hulu", "shahid", "فيلم", "مسلسل", "سينما"],
    title: "ZarynMovies - Movies & TV Shows RSS Feed",
    description: "Latest movies and TV shows news, trailers, and reviews (EN + AR)",
  },
  "news": {
    categories: ["Sports", "Politics", "Economy", "Health", "Science", "Culture", "General"],
    tags: ["sport", "football", "soccer", "match", "goal", "league", "fifa", "olympic", "nba", "nfl", "champion", "tournament", "transfer", "penalty", "stadium", "world cup", "premier league", "la liga", "bundesliga", "serie a", "champions league", "europa league", "tennis", "boxing", "mma", "ufc", "basketball", "rugby", "cricket", "f1", "formula", "ballon d'or", "hat-trick", "var", "news", "politics", "economy", "health", "science", "رياضة", "كرة القدم", "مباراة", "دوري", "كأس العالم", "البطولة"],
    title: "ZarynMovies - News & Sports RSS Feed",
    description: "Latest news, sports results, highlights, and updates (EN + AR)",
  },
  "tech": {
    categories: ["Technology"],
    tags: ["tech", "technology", "ai", "artificial intelligence", "machine learning", "generative ai", "llm", "gpt", "gemini", "startup", "software", "hardware", "chip", "microchip", "semiconductor", "processor", "gpu", "cpu", "robot", "robotics", "cyber", "cybersecurity", "cloud computing", "saas", "smartphone", "gadget", "nvidia", "openai", "tsmc", "intel", "amd", "qualcomm", "quantum", "5g", "6g", "blockchain", "crypto", "vr", "metaverse", "iot", "drone", "spacex", "nasa", "satellite", "neural", "transformer", "diffusion", "تقنية", "تكنولوجيا", "ذكاء اصطناعي", "برمجة", "إلكترونيات"],
    title: "ZarynMovies - Technology RSS Feed",
    description: "Latest technology news, AI, gadgets, and innovations (EN + AR)",
  },
  "all": {
    categories: [],
    tags: [],
    title: "ZarynMovies - All News",
    description: "All latest news from ZarynMovies",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const feedType = url.searchParams.get("feed") || "all";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const feedConfig = FEED_FILTERS[feedType] || FEED_FILTERS["all"];
    const siteUrl = "https://zarynmoviescom.lovable.app";

    let query = supabase
      .from("sports_news")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (feedConfig.categories.length > 0) {
      query = query.in("category", feedConfig.categories);
    }

    const { data: items, error } = await query;
    if (error) throw error;

    let filtered = items || [];
    if (feedConfig.tags && feedConfig.tags.length > 0) {
      filtered = filtered.filter(item => {
        const text = ((item.title || "") + " " + (item.content || "") + " " + (item.tags || []).join(" ")).toLowerCase();
        return feedConfig.tags!.some(tag => text.includes(tag));
      });
    }

    const rssXml = buildRssXml(feedConfig.title, feedConfig.description, siteUrl, filtered);

    return new Response(rssXml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
