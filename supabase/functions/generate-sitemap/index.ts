import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/xml; charset=utf-8",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const baseUrl = "https://zarynmovies.com";
  const languages = ["en", "ar", "fr"];
  const urls: string[] = [];

  try {
    // Always fetch ALL dynamic records directly from the database.
    const [movies, anime, series, articles, news] = await Promise.all([
      supabase.from("movies").select("id, slug, updated_at").order("updated_at", { ascending: false }),
      supabase.from("anime").select("id, slug, updated_at").order("updated_at", { ascending: false }),
      supabase.from("series").select("id, slug, updated_at").eq("visible", true).order("updated_at", { ascending: false }),
      supabase.from("articles").select("id, slug, updated_at, published_at").eq("status", "published").order("published_at", { ascending: false }),
      supabase.from("sports_news").select("id, updated_at, published_at").eq("status", "published").order("published_at", { ascending: false }),
    ]);

    // ── Static pages ──
    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/movies", priority: "0.9", changefreq: "daily" },
      { loc: "/anime", priority: "0.9", changefreq: "daily" },
      { loc: "/series", priority: "0.9", changefreq: "daily" },
      { loc: "/news", priority: "0.8", changefreq: "daily" },
      { loc: "/articles", priority: "0.8", changefreq: "daily" },
      { loc: "/summaries", priority: "0.7", changefreq: "daily" },
      { loc: "/entertainment", priority: "0.6", changefreq: "weekly" },
      { loc: "/subscribe", priority: "0.5", changefreq: "monthly" },
      { loc: "/contact", priority: "0.4", changefreq: "monthly" },
      { loc: "/privacy-policy", priority: "0.3", changefreq: "monthly" },
      { loc: "/terms-of-service", priority: "0.3", changefreq: "monthly" },
      { loc: "/about-us", priority: "0.3", changefreq: "monthly" },
      { loc: "/contact-us", priority: "0.3", changefreq: "monthly" },
      { loc: "/dmca", priority: "0.3", changefreq: "monthly" },
    ];

    for (const page of staticPages) {
      const alternates = languages
        .map((lang) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}${page.loc}" />`)
        .join("");
      urls.push(`  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${alternates}
  </url>`);
    }

    // ── Movies ──
    for (const m of movies.data || []) {
      const slug = m.slug || m.id;
      const alternates = languages
        .map((lang) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}/movies/${slug}" />`)
        .join("");
      urls.push(`  <url>
    <loc>${baseUrl}/movies/${slug}</loc>
    <lastmod>${new Date(m.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${alternates}
  </url>`);
    }

    // ── Anime ──
    for (const a of anime.data || []) {
      const slug = a.slug || a.id;
      const alternates = languages
        .map((lang) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}/anime/${slug}" />`)
        .join("");
      urls.push(`  <url>
    <loc>${baseUrl}/anime/${slug}</loc>
    <lastmod>${new Date(a.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${alternates}
  </url>`);
    }

    // ── Series ──
    for (const s of series.data || []) {
      const slug = s.slug || s.id;
      const alternates = languages
        .map((lang) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}/series/${slug}" />`)
        .join("");
      urls.push(`  <url>
    <loc>${baseUrl}/series/${slug}</loc>
    <lastmod>${new Date(s.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${alternates}
  </url>`);
    }

    // ── Articles ──
    for (const a of articles.data || []) {
      const slug = a.slug || a.id;
      const alternates = languages
        .map((lang) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}/articles/${slug}" />`)
        .join("");
      urls.push(`  <url>
    <loc>${baseUrl}/articles/${slug}</loc>
    <lastmod>${new Date(a.updated_at || a.published_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${alternates}
  </url>`);
    }

    // ── Sports News ──
    for (const n of news.data || []) {
      const alternates = languages
        .map((lang) => `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${baseUrl}/${lang}/news/${n.id}" />`)
        .join("");
      urls.push(`  <url>
    <loc>${baseUrl}/news/${n.id}</loc>
    <lastmod>${new Date(n.updated_at || n.published_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${alternates}
  </url>`);
    }
  } catch {
    // Minimal fallback on error
    urls.push(`  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

  return new Response(sitemap, { headers: corsHeaders });
});