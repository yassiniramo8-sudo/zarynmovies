import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeTrending } from "@/lib/homeTrending";
import { SectionRail } from "./SectionRail";
import { HomeCardItem } from "./HomeCard";
import { useAuth } from "@/contexts/AuthContext";
import { useSectionItems } from "@/hooks/useHomeLayout";
import type { HomeSection } from "@/hooks/useHomeLayout";

interface Props { section: HomeSection }

async function fetchByType(type: "movie" | "anime" | "series", limit: number, order: "created_at" = "created_at"): Promise<HomeCardItem[]> {
  const tbl = type === "movie" ? "movies" : type === "anime" ? "anime" : "series";
  let q: any = supabase.from(tbl as any).select("id,title,poster_url,rating,year,vip_only").order(order, { ascending: false }).limit(limit);
  if (type === "series") q = q.eq("visible", true);
  const { data } = await q;
  return ((data as any[]) || []).map((r) => ({ ...r, type }));
}

async function fetchByGenre(genre: string, type: "movie" | "anime" | "series", limit: number): Promise<HomeCardItem[]> {
  const tbl = type === "movie" ? "movies" : type === "anime" ? "anime" : "series";
  let q: any = supabase.from(tbl as any).select("id,title,poster_url,rating,year,vip_only").contains("genre", [genre]).order("created_at", { ascending: false }).limit(limit);
  if (type === "series") q = q.eq("visible", true);
  const { data } = await q;
  return ((data as any[]) || []).map((r) => ({ ...r, type }));
}

export function AutoSection({ section }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<HomeCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = section;
  const limit = settings?.itemCount ?? 20;
  const { items: manualItems } = useSectionItems(
    section.type === "editor_picks" || section.type === "vip" ? section.id : null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let result: HomeCardItem[] = [];
      try {
        switch (section.type) {
          case "trending": {
            const t = await computeTrending({ windowDays: settings?.windowDays ?? 7, weights: settings?.weights, limit });
            result = t.map((x) => ({ id: x.id, title: x.title, poster_url: x.poster_url, rating: x.rating, year: x.year, type: x.type, vip_only: x.vip_only }));
            break;
          }
          case "popular_week": {
            const t = await computeTrending({ windowDays: settings?.windowDays ?? 7, weights: { views: 70, likes: 20, comments: 10 }, limit });
            result = t.map((x) => ({ id: x.id, title: x.title, poster_url: x.poster_url, rating: x.rating, year: x.year, type: x.type, vip_only: x.vip_only }));
            break;
          }
          case "most_viewed_today": {
            const t = await computeTrending({ windowDays: 1, weights: { views: 100 }, limit });
            result = t.map((x) => ({ id: x.id, title: x.title, poster_url: x.poster_url, rating: x.rating, year: x.year, type: x.type, vip_only: x.vip_only }));
            break;
          }
          case "new_releases":
          case "recently_added": {
            const [m, a, s] = await Promise.all([
              fetchByType("movie", limit),
              fetchByType("anime", Math.ceil(limit / 2)),
              fetchByType("series", Math.ceil(limit / 2)),
            ]);
            result = [...m, ...a, ...s].sort(() => 0).slice(0, limit);
            break;
          }
          case "category": {
            const genre = settings?.genre;
            const ct = (settings?.contentType as any) || "movie";
            result = genre ? await fetchByGenre(genre, ct, limit) : await fetchByType(ct, limit);
            break;
          }
          case "editor_picks":
          case "vip": {
            const byType: Record<string, string[]> = {};
            manualItems.forEach((m) => { (byType[m.content_type] ||= []).push(m.content_id); });
            const collected: HomeCardItem[] = [];
            for (const [ct, ids] of Object.entries(byType)) {
              const tbl = ct === "movie" ? "movies" : ct === "anime" ? "anime" : "series";
              const { data } = await supabase.from(tbl as any).select("id,title,poster_url,rating,year,vip_only").in("id", ids);
              ((data as any[]) || []).forEach((r) => collected.push({ ...r, type: ct as any }));
            }
            if (section.type === "vip" && collected.length === 0) {
              const { data } = await supabase.from("movies").select("id,title,poster_url,rating,year,vip_only").eq("vip_only", true).limit(limit);
              ((data as any[]) || []).forEach((r) => collected.push({ ...r, type: "movie" }));
            }
            result = collected;
            break;
          }
          case "continue_watching": {
            if (!user) { result = []; break; }
            const { data: hist } = await supabase.from("watch_history").select("content_id, content_type").eq("user_id", user.id).order("watched_at", { ascending: false }).limit(limit);
            const byType: Record<string, string[]> = {};
            ((hist as any[]) || []).forEach((h) => { (byType[h.content_type] ||= []).push(h.content_id); });
            const collected: HomeCardItem[] = [];
            for (const [ct, ids] of Object.entries(byType)) {
              const tbl = ct === "movie" ? "movies" : ct === "anime" ? "anime" : "series";
              const { data } = await supabase.from(tbl as any).select("id,title,poster_url,rating,year,vip_only").in("id", ids);
              ((data as any[]) || []).forEach((r) => collected.push({ ...r, type: ct as any, progressPct: 30 } as any));
            }
            result = collected;
            break;
          }
          case "ai_recs": {
            try {
              const { data } = await supabase.functions.invoke("ai-recommendations", { body: { content_type: settings?.contentType ?? "movie", limit } });
              const recs = (data?.recommendations || []) as any[];
              result = recs.map((r) => ({ id: r.id, title: r.title, poster_url: r.poster_url, rating: r.rating, year: r.year, type: (settings?.contentType ?? "movie") as any, vip_only: r.vip_only }));
            } catch { result = []; }
            break;
          }
        }
      } catch (e) {
        console.error("AutoSection", section.key, e);
      }
      if (!cancelled) { setItems(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [section.id, section.type, JSON.stringify(settings), user?.id, manualItems.length]);

  return (
    <SectionRail
      sectionKey={section.key}
      titleI18n={section.title_i18n}
      descI18n={section.description_i18n}
      items={items}
      loading={loading}
      showBetweenAds
    />
  );
}
