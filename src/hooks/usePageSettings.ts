import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";

export type PageStatus = "visible" | "hidden" | "maintenance" | "admin_only";
export type PageCategory = "main" | "content" | "categories" | "user" | "vip" | "system" | "homepage" | "admin";

export interface PageSetting {
  id: string;
  route_key: string;
  category: PageCategory | string;
  label: string;
  icon: string | null;
  status: PageStatus;
  show_in_nav: boolean;
  show_in_footer: boolean;
  show_in_sidebar: boolean;
  sort_order: number;
  is_system: boolean;
  redirect_to: string | null;
  updated_at: string;
}

let cache: PageSetting[] | null = null;
const listeners = new Set<(rows: PageSetting[]) => void>();
let unsubRealtime: (() => void) | null = null;

async function loadAll(): Promise<PageSetting[]> {
  const { data, error } = await supabase
    .from("page_settings" as any)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[usePageSettings] load failed", error.message);
    return [];
  }
  return (data as unknown as PageSetting[]) || [];
}

function broadcast(rows: PageSetting[]) {
  cache = rows;
  listeners.forEach((l) => {
    try { l(rows); } catch { /* ignore */ }
  });
}

function ensureRealtime() {
  if (unsubRealtime) return;
  unsubRealtime = realtimeManager.subscribe("page-settings", {
    tables: [{ schema: "public", table: "page_settings" }],
    onChange: async () => {
      try {
        const rows = await loadAll();
        broadcast(rows);
      } catch (err) {
        console.error("[usePageSettings] realtime handler failed:", err);
      }
    },
  });
}

export function usePageSettings() {
  const [rows, setRows] = useState<PageSetting[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    let mounted = true;
    const wrappedSetRows: typeof setRows = (rows) => {
      if (mounted) setRows(rows);
    };
    listeners.add(wrappedSetRows);
    ensureRealtime();
    if (cache === null) {
      loadAll().then((r) => {
        if (!mounted) return;
        broadcast(r);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
      listeners.delete(wrappedSetRows);
    };
  }, []);

  const byRoute = useMemo(() => {
    const map = new Map<string, PageSetting>();
    rows.forEach((r) => map.set(r.route_key, r));
    return map;
  }, [rows]);

  const update = useCallback(async (id: string, patch: Partial<PageSetting>) => {
    const { error } = await supabase.from("page_settings" as any).update(patch).eq("id", id);
    if (error) throw error;
  }, []);

  return { rows, byRoute, loading, update };
}

/** Resolve visibility for a route path (falls back to visible if unknown). */
export function resolveRouteStatus(path: string, byRoute: Map<string, PageSetting>): PageStatus {
  // exact match first, then strip locale prefix like /ar/movies -> /movies
  const localeStripped = path.replace(/^\/(ar|en|fr|es|de|pt|ja)(?=\/|$)/, "") || "/";
  const candidates = [path, localeStripped];
  for (const c of candidates) {
    const s = byRoute.get(c);
    if (s) return s.status;
  }
  // parametric: /movies/:id -> /movies
  const first = "/" + (localeStripped.split("/").filter(Boolean)[0] ?? "");
  const s = byRoute.get(first);
  return s?.status ?? "visible";
}
