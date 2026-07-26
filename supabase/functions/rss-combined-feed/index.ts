import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    const siteUrl = "https://zaryn.movies";
    const limit = 50;

    // Fetch movies, anime, series in parallel
    const [movies, anime, series] = await Promise.all([
      sb.from("movies").select("id,title,description,poster_url,created_at,genre,year").order("created_at", { ascending: false }).limit(limit),
      sb.from("anime").select("id,title,description,poster_url,created_at,genre,year").order("created_at", { ascending: false }).limit(limit),
      sb.from("series").select("id,title,description,poster_url,created_at,genre,year").order("created_at", { ascending: false }).limit(limit),
    ]);

    const items: any[] = [];
    const addItems = (data: any[] | null, type: string) => {
      (data || []).forEach((i) => items.push({ ...i, _type: type }));
    };
    addItems(movies.data, "movies");
    addItems(anime.data, "anime");
    addItems(series.data, "series");

    // Sort by created_at descending
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const itemsXml = items.slice(0, 100).map((item) => {
      const link = `${siteUrl}/${item._type}/${item.id}`;
      const desc = item.description?.substring(0, 500) || "";
      const enclosure = item.poster_url ? `<enclosure url="${esc(item.poster_url)}" type="image/jpeg" length="0" />` : "";
      const categories = (item.genre || []).map((g: string) => `<category>${esc(g)}</category>`).join("");

      return `
    <item>
      <title>${esc(item.title)}</title>
      <link>${esc(link)}</link>
      <description><![CDATA[${desc}]]></description>
      <pubDate>${new Date(item.created_at).toUTCString()}</pubDate>
      <guid isPermaLink="true">${esc(link)}</guid>
      ${enclosure}
      <category>${esc(item._type)}</category>
      ${categories}
    </item>`;
    }).join("");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zaryn Movies - Latest Content</title>
    <description>The latest movies, anime, and series on Zaryn Movies</description>
    <link>${siteUrl}</link>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>30</ttl>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch (e) {
    console.error("RSS Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
