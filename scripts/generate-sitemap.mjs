/**
 * Build-time sitemap generator.
 *
 * Queries Supabase for all active content and writes `public/sitemap.xml`.
 * Run before `vite build` so the static file is always fresh at deploy time.
 *
 * Usage: node scripts/generate-sitemap.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outPath = resolve(rootDir, "public", "sitemap.xml");

// Load .env file manually (no dotenv dependency needed)
try {
  const envPath = resolve(rootDir, ".env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes (single or double)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env file not found — env vars must already be set
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://zjlsmwcrenzdvdkfyhdx.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!SUPABASE_ANON_KEY) {
  console.error("❌ VITE_SUPABASE_PUBLISHABLE_KEY is required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BASE_URL = "https://zarynmovies.com";
const LANGUAGES = ["en", "ar", "fr"];

// ── Helpers ──

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;");
}

function dateStr(d) {
  return new Date(d).toISOString().split("T")[0];
}

function alternates(path) {
  return LANGUAGES.map(
    (lang) =>
      `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}${path}" />`
  ).join("");
}

function urlBlock({ loc, lastmod, changefreq, priority, alts }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(BASE_URL + loc)}</loc>`,
    lastmod ? `    <lastmod>${dateStr(lastmod)}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    alts || "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Main ──

async function main() {
  console.log("🔍 Fetching content from Supabase…");

  const [movies, anime, series, articles, news] = await Promise.all([
    supabase.from("movies").select("id, slug, updated_at").order("updated_at", { ascending: false }),
    supabase.from("anime").select("id, slug, updated_at").order("updated_at", { ascending: false }),
    supabase.from("series").select("id, slug, updated_at").eq("visible", true).order("updated_at", { ascending: false }),
    supabase.from("articles").select("id, slug, updated_at, published_at").eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("sports_news").select("id, updated_at, published_at").eq("status", "published").order("published_at", { ascending: false }),
  ]);

  const lines = [];

  // Static pages
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
    lines.push(urlBlock({ loc: page.loc, changefreq: page.changefreq, priority: page.priority, alts: alternates(page.loc) }));
  }

  // Movies
  for (const m of movies.data || []) {
    const slug = escapeXml(m.slug || m.id);
    const path = `/movies/${slug}`;
    lines.push(urlBlock({ loc: path, lastmod: m.updated_at, changefreq: "weekly", priority: "0.8", alts: alternates(path) }));
  }
  console.log(`   ✅ Movies: ${(movies.data || []).length}`);

  // Anime
  for (const a of anime.data || []) {
    const slug = escapeXml(a.slug || a.id);
    const path = `/anime/${slug}`;
    lines.push(urlBlock({ loc: path, lastmod: a.updated_at, changefreq: "weekly", priority: "0.8", alts: alternates(path) }));
  }
  console.log(`   ✅ Anime: ${(anime.data || []).length}`);

  // Series
  for (const s of series.data || []) {
    const slug = escapeXml(s.slug || s.id);
    const path = `/series/${slug}`;
    lines.push(urlBlock({ loc: path, lastmod: s.updated_at, changefreq: "weekly", priority: "0.8", alts: alternates(path) }));
  }
  console.log(`   ✅ Series: ${(series.data || []).length}`);

  // Articles
  for (const a of articles.data || []) {
    const slug = escapeXml(a.slug || a.id);
    const path = `/articles/${slug}`;
    lines.push(urlBlock({ loc: path, lastmod: a.updated_at || a.published_at, changefreq: "monthly", priority: "0.7", alts: alternates(path) }));
  }
  console.log(`   ✅ Articles: ${(articles.data || []).length}`);

  // Sports News
  for (const n of news.data || []) {
    const slug = escapeXml(n.id);
    const path = `/news/${slug}`;
    lines.push(urlBlock({ loc: path, lastmod: n.updated_at || n.published_at, changefreq: "weekly", priority: "0.7", alts: alternates(path) }));
  }
  console.log(`   ✅ News: ${(news.data || []).length}`);

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    lines.join("\n") +
    "\n</urlset>\n";

  writeFileSync(outPath, xml, "utf-8");
  console.log(`🎉 Sitemap written to ${outPath} (${lines.length} URLs)`);
}

main().catch((err) => {
  console.error("❌ Failed to generate sitemap:", err.message);
  process.exit(1);
});