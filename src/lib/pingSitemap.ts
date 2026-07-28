/**
 * Fire-and-forget Google Search Console sitemap ping.
 *
 * Called asynchronously after inserting a new movie, anime, series, or article
 * so it NEVER blocks the admin UI or the database write.
 */
export function pingGoogleSitemap(): void {
  const origin = window.location.origin;
  const sitemapUrl = encodeURIComponent(`${origin}/sitemap.xml`);
  const pingUrl = `https://www.google.com/ping?sitemap=${sitemapUrl}`;

  // Use sendBeacon when available — it's truly fire-and-forget.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(pingUrl);
    return;
  }

  // Fallback: fetch with no waiting, no error handling (best-effort).
  try {
    fetch(pingUrl, { mode: "no-cors", keepalive: true }).catch(() => {
      /* silently ignore */
    });
  } catch {
    /* silently ignore */
  }
}