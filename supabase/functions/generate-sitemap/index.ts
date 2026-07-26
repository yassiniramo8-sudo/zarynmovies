import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const baseUrl = "https://zaryn.movies";
  const languages = ["en", "ar", "fr"];

  // Fetch admin-managed sitemap URLs
  const { data: sitemapUrls } = await supabase
    .from("sitemap_urls")
    .select("*")
    .eq("active", true)
    .order("url_type")
    .order("priority", { ascending: false });

  const urls: string[] = [];

  if (sitemapUrls && sitemapUrls.length > 0) {
    // Use admin-managed URLs
    for (const entry of sitemapUrls) {
      const lastmod = entry.last_modified
        ? `\n    <lastmod>${new Date(entry.last_modified).toISOString().split("T")[0]}</lastmod>`
        : "";

      // Build xhtml:link alternates for multi-language
      const alternates = languages
        .map(
          (lang) =>
            `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}${entry.url}" />`
        )
        .join("");

      urls.push(`  <url>
    <loc>${baseUrl}${entry.url}</loc>${lastmod}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${alternates}
  </url>`);
    }
  } else {
    // Fallback: generate from content tables directly
    const [movies, anime, series, articles] = await Promise.all([
      supabase.from("movies").select("id, updated_at").order("updated_at", { ascending: false }),
      supabase.from("anime").select("id, updated_at").order("updated_at", { ascending: false }),
      supabase.from("series").select("id, updated_at").eq("visible", true).order("updated_at", { ascending: false }),
      supabase.from("articles").select("id, updated_at, published_at").eq("status", "published").order("published_at", { ascending: false }),
    ]);

    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/movies", priority: "0.9", changefreq: "daily" },
      { loc: "/anime", priority: "0.9", changefreq: "daily" },
      { loc: "/series", priority: "0.9", changefreq: "daily" },
      { loc: "/articles", priority: "0.8", changefreq: "daily" },
      { loc: "/backgrounds", priority: "0.6", changefreq: "weekly" },
      { loc: "/contact", priority: "0.4", changefreq: "monthly" },
      { loc: "/subscribe", priority: "0.5", changefreq: "monthly" },
    ];

    for (const page of staticPages) {
      urls.push(`  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
    }

    for (const m of movies.data || []) {
      urls.push(`  <url>
    <loc>${baseUrl}/movies/${m.id}</loc>
    <lastmod>${new Date(m.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    for (const a of anime.data || []) {
      urls.push(`  <url>
    <loc>${baseUrl}/anime/${a.id}</loc>
    <lastmod>${new Date(a.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    for (const s of series.data || []) {
      urls.push(`  <url>
    <loc>${baseUrl}/series/${s.id}</loc>
    <lastmod>${new Date(s.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    for (const a of articles.data || []) {
      urls.push(`  <url>
    <loc>${baseUrl}/articles/${a.id}</loc>
    <lastmod>${new Date(a.updated_at || a.published_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemap, { headers: corsHeaders });
});
