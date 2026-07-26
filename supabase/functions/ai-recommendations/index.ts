import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch RSS-aggregated content for a category
async function getRSSRecommendations(supabase: any, category: string, limit: number, excludeIds: Set<string>) {
  const catMap: Record<string, string[]> = {
    movie: ["Entertainment", "entertainment"],
    anime: ["anime", "Anime"],
    series: ["Entertainment", "entertainment"],
  };
  const cats = catMap[category] || ["Entertainment"];

  const { data } = await supabase
    .from("sports_news")
    .select("id, title, title_ar, excerpt, excerpt_ar, image_url, source_url, source_name, category, tags, published_at")
    .eq("status", "published")
    .in("category", cats)
    .order("published_at", { ascending: false })
    .limit(limit * 2);

  return (data || [])
    .filter((item: any) => !excludeIds.has(item.id))
    .slice(0, limit)
    .map((item: any) => ({
      ...item,
      source: "rss",
      content_type: category,
    }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getClaims(token);
      userId = data?.claims?.sub || null;
    }

    const { content_type, limit = 10, include_rss = true } = await req.json();

    // Strategy 1: If user is logged in, use their watch history + ratings
    if (userId) {
      const { data: history } = await adminClient
        .from("watch_history")
        .select("content_id, content_type")
        .eq("user_id", userId)
        .order("watched_at", { ascending: false })
        .limit(20);

      const { data: ratings } = await adminClient
        .from("user_ratings")
        .select("content_id, content_type, rating")
        .eq("user_id", userId)
        .gte("rating", 4)
        .limit(20);

      const watchedIds = new Set([
        ...(history || []).map((h: any) => h.content_id),
        ...(ratings || []).map((r: any) => r.content_id),
      ]);

      const targetType = content_type || "movie";
      const table = targetType === "movie" ? "movies" : targetType === "anime" ? "anime" : "series";

      const contentIds = [...watchedIds].slice(0, 10);
      let preferredGenres: string[] = [];

      if (contentIds.length > 0) {
        const { data: watchedContent } = await adminClient
          .from(table)
          .select("genre")
          .in("id", contentIds);
        preferredGenres = [...new Set((watchedContent || []).flatMap((c: any) => c.genre || []))];
      }

      let query = adminClient.from(table).select("*").limit(limit * 2);
      if (preferredGenres.length > 0) {
        query = query.overlaps("genre", preferredGenres);
      }
      const { data: recommendations } = await query.order("rating", { ascending: false });

      const filtered = (recommendations || [])
        .filter((r: any) => !watchedIds.has(r.id))
        .slice(0, limit)
        .map((r: any) => ({ ...r, source: "local", content_type: targetType }));

      // Fill with trending if not enough
      if (filtered.length < limit) {
        const { data: trending } = await adminClient
          .from(table)
          .select("*")
          .eq("trending", true)
          .order("created_at", { ascending: false })
          .limit(limit - filtered.length);

        const existingIds = new Set(filtered.map((f: any) => f.id));
        (trending || []).forEach((t: any) => {
          if (!existingIds.has(t.id) && !watchedIds.has(t.id)) {
            filtered.push({ ...t, source: "local", content_type: targetType });
          }
        });
      }

      // Add RSS recommendations if requested
      let rssItems: any[] = [];
      if (include_rss) {
        const existingIds = new Set(filtered.map((f: any) => f.id));
        rssItems = await getRSSRecommendations(adminClient, targetType, Math.min(limit, 10), existingIds);
      }

      return new Response(JSON.stringify({
        recommendations: filtered,
        rss_recommendations: rssItems,
        source: "personalized",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strategy 2: No user - return trending + top rated + RSS
    const targetType = content_type || "movie";
    const table = targetType === "movie" ? "movies" : targetType === "anime" ? "anime" : "series";

    const [trendingRes, topRatedRes] = await Promise.all([
      adminClient.from(table).select("*").eq("trending", true).order("created_at", { ascending: false }).limit(Math.ceil(limit / 2)),
      adminClient.from(table).select("*").order("rating", { ascending: false }).limit(limit),
    ]);

    const seen = new Set<string>();
    const combined: any[] = [];
    [...(trendingRes.data || []), ...(topRatedRes.data || [])].forEach((item) => {
      if (!seen.has(item.id) && combined.length < limit) {
        seen.add(item.id);
        combined.push({ ...item, source: "local", content_type: targetType });
      }
    });

    // Add RSS recommendations
    let rssItems: any[] = [];
    if (include_rss) {
      rssItems = await getRSSRecommendations(adminClient, targetType, Math.min(limit, 10), seen);
    }

    return new Response(JSON.stringify({
      recommendations: combined,
      rss_recommendations: rssItems,
      source: "trending",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", recommendations: [], rss_recommendations: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
