/**
 * Build-time sitemap generator — paginated, exhaustive, Docker-safe.
 *
 * Fetches EVERY row from every content table by paginating past Supabase's
 * 1000-row default limit. Falls back to hardcoded credentials when
 * environment variables are missing (CI/Docker-safe).
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

// ── Credentials ──────────────────────────────────────────────────────

// 1) Try .env file
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found */ }

// 2) Hardcoded fallback (CI/Docker-safe)
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  "https://zjlsmwcrenzdvdkfyhdx.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbHNtd2NyZW56ZHZka2Z5aGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NDc1MDQsImV4cCI6MjA4ODUyMzUwNH0.I1Adxk2J7_zU8XCGXWTYEKSSvCrZWHtaMbb6elKIUBM";

const BASE_URL = "https://zarynmovies.com";
const LANGUAGES = ["en", "ar", "fr"];

// ── Paginated fetch helper ──────────────────────────────────────────

/**
 * Fetches ALL rows from a table by paginating with `range()`.
 * Supabase's default page size is 1000 — this loops until no more rows.
 */
async function fetchAll(supabase, table, select, filter) {
  const PAGE = 1000;
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE - 1);

    if (filter) query = filter(query);

    const { data, error } = await query;
    if (error) {
      console.warn(`   ⚠️  ${table}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;
    rows.push(...data);

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

// ── XML helpers ──────────────────────────────────────────────────────

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&#38;")
    .replace(/</g, "&#60;")
    .replace(/>/g, "&#62;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;");
}

function dateStr(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function alternates(path) {
  return LANGUAGES.map(
    (lang) =>
      `\n    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}/${lang}${path}" />`
  ).join("");
}

function urlEntry({ loc, lastmod, changefreq, priority, alts }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(BASE_URL + loc)}</loc>`,
    lastmod ? `    <lastmod>${dateStr(lastmod)}</lastmod>` : "",
    `    <changefreq>${changefreq || "daily"}</changefreq>`,
    `    <priority>${priority || "0.5"}</priority>`,
    alts || "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Static pages ─────────────────────────────────────────────────────

function staticPages() {
  const pages = [
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

  return pages.map((p) =>
    urlEntry({ ...p, alts: alternates(p.loc) })
  );
}

// ── Dynamic content ─────────────────────────────────────────────────

async function buildDynamic(supabase) {
  const lines = [];

  // ── Movies ──
  const movies = await fetchAll(supabase, "movies", "id, updated_at, created_at");
  for (const m of movies) {
    const path = `/movies/${m.id}`;
    const lastmod = m.updated_at || m.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.8", alts: alternates(path) }));
  }
  console.log(`  ✅ Movies: ${movies.length}`);

  // ── Anime ──
  const anime = await fetchAll(supabase, "anime", "id, updated_at, created_at");
  for (const a of anime) {
    const path = `/anime/${a.id}`;
    const lastmod = a.updated_at || a.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.8", alts: alternates(path) }));
  }
  console.log(`  ✅ Anime: ${anime.length}`);

  // ── Series ──
  const series = await fetchAll(supabase, "series", "id, updated_at, created_at, visible");
  const visibleSeries = series.filter((s) => s.visible !== false);
  for (const s of visibleSeries) {
    const path = `/series/${s.id}`;
    const lastmod = s.updated_at || s.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.8", alts: alternates(path) }));
  }
  console.log(`  ✅ Series: ${visibleSeries.length}`);

  // ── Episodes (individual episode pages) ──
  const episodes = await fetchAll(supabase, "episodes", "id, series_id, updated_at, created_at");
  for (const ep of episodes) {
    const parent = series.find((s) => s.id === ep.series_id);
    const seriesId = parent ? parent.id : ep.series_id;
    const path = `/series/${seriesId}/episode/${ep.id}`;
    const lastmod = ep.updated_at || ep.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.7", alts: alternates(path) }));
  }
  console.log(`  ✅ Episodes: ${episodes.length}`);

  // ── Articles ──
  const articles = await fetchAll(
    supabase,
    "articles",
    "id, updated_at, published_at, created_at",
    (q) => q.eq("status", "published")
  );
  for (const a of articles) {
    const path = `/articles/${a.id}`;
    const lastmod = a.updated_at || a.published_at || a.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.7", alts: alternates(path) }));
  }
  console.log(`  ✅ Articles: ${articles.length}`);

  // ── Sports News ──
  const news = await fetchAll(
    supabase,
    "sports_news",
    "id, updated_at, published_at, created_at",
    (q) => q.eq("status", "published")
  );
  for (const n of news) {
    const path = `/news/${n.id}`;
    const lastmod = n.updated_at || n.published_at || n.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.7", alts: alternates(path) }));
  }
  console.log(`  ✅ Sports News: ${news.length}`);

  // ── Summaries / Highlights ──
  const highlights = await fetchAll(supabase, "highlights", "id, updated_at, created_at");
  for (const h of highlights) {
    const path = `/summaries/sport/${h.id}`;
    const lastmod = h.updated_at || h.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.6", alts: alternates(path) }));
  }
  console.log(`  ✅ Highlights: ${highlights.length}`);

  // ── Polls ──
  const polls = await fetchAll(supabase, "polls", "id, updated_at, created_at");
  for (const p of polls) {
    const lastmod = p.updated_at || p.created_at;
    lines.push(urlEntry({ loc: "/news/polls", lastmod, changefreq: "daily", priority: "0.6" }));
  }
  console.log(`  ✅ Polls: ${polls.length}`);

  // ── Categories / Genres (anime groups) ──
  const genres = await fetchAll(supabase, "anime_groups", "id, updated_at, created_at");
  for (const g of genres) {
    const path = `/anime/group/${g.id}`;
    const lastmod = g.updated_at || g.created_at;
    lines.push(urlEntry({ loc: path, lastmod, changefreq: "daily", priority: "0.4", alts: alternates(path) }));
  }
  console.log(`  ✅ Anime Groups: ${genres.length}`);

  return lines;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Fetching ALL content from Supabase (paginated)…");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const staticLines = staticPages();
  const dynamicLines = await buildDynamic(supabase);

  const allLines = [...staticLines, ...dynamicLines];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    allLines.join("\n") +
    "\n</urlset>\n";

  writeFileSync(outPath, xml, "utf-8");
  console.log(`🎉 Sitemap written (${allLines.length} total URLs)`);
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});