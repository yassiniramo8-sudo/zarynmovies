import { supabase } from "@/integrations/supabase/client";

export interface TrendingWeights {
  views?: number;
  rating?: number;
  likes?: number;
  comments?: number;
  watch?: number;
  favorites?: number;
}

export interface TrendingOptions {
  contentTypes?: ("movie" | "anime" | "series")[];
  windowDays?: number;
  weights?: TrendingWeights;
  limit?: number;
  genre?: string;
}

export interface TrendingItem {
  id: string;
  title: string;
  poster_url: string | null;
  rating: number | null;
  year: number | null;
  genre: string[] | null;
  description: string | null;
  trending: boolean | null;
  trailer_url: string | null;
  type: "movie" | "anime" | "series";
  score: number;
  vip_only?: boolean;
}

function normalize(map: Map<string, number>) {
  const values = Array.from(map.values());
  const max = Math.max(1, ...values);
  const norm = new Map<string, number>();
  map.forEach((v, k) => norm.set(k, v / max));
  return norm;
}

async function fetchCounts(table: string, since: string | null, contentType: string) {
  let q = supabase.from(table as any).select("content_id, content_type").eq("content_type", contentType);
  if (since) q = q.gte("created_at", since);
  const { data } = await q;
  const map = new Map<string, number>();
  ((data as any[]) || []).forEach((r) => {
    map.set(r.content_id, (map.get(r.content_id) || 0) + 1);
  });
  return map;
}

/** Compute trending items across chosen content types with weighted metrics. */
export async function computeTrending(opts: TrendingOptions = {}): Promise<TrendingItem[]> {
  const {
    contentTypes = ["movie", "anime", "series"],
    windowDays = 7,
    weights = { views: 60, rating: 25, likes: 15 },
    limit = 20,
    genre,
  } = opts;

  const since = windowDays > 0 ? new Date(Date.now() - windowDays * 86400000).toISOString() : null;
  const all: TrendingItem[] = [];

  for (const ct of contentTypes) {
    const table = ct === "movie" ? "movies" : ct === "anime" ? "anime" : "series";
    let q: any = supabase.from(table as any).select("*").limit(200);
    if (ct === "series") q = q.eq("visible", true);
    if (genre) q = q.contains("genre", [genre]);
    const { data: rows } = await q;
    const list = (rows as any[]) || [];
    if (!list.length) continue;

    const [views, likes, comments, watch] = await Promise.all([
      fetchCounts("content_views", since, ct),
      fetchCounts("likes", null, ct),
      fetchCounts("comments", since, ct),
      fetchCounts("watch_history", since, ct === "series" ? "movie" : ct),
    ]);
    const nViews = normalize(views);
    const nLikes = normalize(likes);
    const nComments = normalize(comments);
    const nWatch = normalize(watch);

    const wSum =
      (weights.views ?? 0) + (weights.rating ?? 0) + (weights.likes ?? 0) +
      (weights.comments ?? 0) + (weights.watch ?? 0) + (weights.favorites ?? 0);
    const denom = wSum || 1;

    for (const r of list) {
      const ratingNorm = Math.min(1, (r.rating || 0) / 10);
      const score =
        ((weights.views ?? 0) * (nViews.get(r.id) || 0) +
          (weights.rating ?? 0) * ratingNorm +
          (weights.likes ?? 0) * (nLikes.get(r.id) || 0) +
          (weights.comments ?? 0) * (nComments.get(r.id) || 0) +
          (weights.watch ?? 0) * (nWatch.get(r.id) || 0)) / denom;
      all.push({
        id: r.id,
        title: r.title,
        poster_url: r.poster_url,
        rating: r.rating,
        year: r.year,
        genre: r.genre,
        description: r.description,
        trending: r.trending,
        trailer_url: r.trailer_url,
        type: ct,
        vip_only: r.vip_only,
        score,
      });
    }
  }

  all.sort((a, b) => b.score - a.score || (b.rating || 0) - (a.rating || 0));
  return all.slice(0, limit);
}
