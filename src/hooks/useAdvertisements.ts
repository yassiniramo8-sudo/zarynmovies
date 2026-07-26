import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";

export interface Advertisement {
  id: string;
  title: string;
  ad_type: string;
  placement: string;
  content_html: string | null;
  image_url: string | null;
  link_url: string | null;
  target_pages: string[];
  target_content_id: string | null;
  target_content_type: string | null;
  sort_order: number;
  active: boolean;
  hide_for_vip: boolean;
  language: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  start_at: string | null;
  end_at: string | null;
  priority: number;
  device_targeting: string[];
  user_type: string;
  max_impressions: number | null;
  max_clicks: number | null;
  impressions_count: number;
  clicks_count: number;
  ab_group: string | null;
  trigger_config?: any;
}

export interface AdGlobalSettings {
  id: string;
  ads_enabled: boolean;
  google_ads_enabled: boolean;
  affiliate_ads_enabled: boolean;
  emergency_hide: boolean;
  ad_intensity: number;
  debug_mode: boolean;
  updated_at: string;
}

export interface AdPlacementSetting {
  placement: string;
  intensity: number;
  enabled: boolean;
  note: string | null;
  updated_at: string;
}

export interface AdAuditEntry {
  id: string;
  ad_id: string | null;
  actor_id: string | null;
  action: string;
  reason: string | null;
  details: any;
  created_at: string;
}

/** Admin hook: all ads + centralized realtime */
export function useAdvertisements() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchAds = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const { data } = await supabase
        .from("advertisements")
        .select("*")
        .order("priority", { ascending: false })
        .order("sort_order", { ascending: true });
      if (mountedRef.current) {
        setAds((data as unknown as Advertisement[]) || []);
      }
    } catch (err) {
      console.error("[useAdvertisements] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAds();
    const unsub = realtimeManager.subscribe("ads-admin", {
      tables: [{ schema: "public", table: "advertisements" }],
      onChange: fetchAds,
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [fetchAds]);

  return { ads, loading, refetch: fetchAds };
}

/** Detect current device tier */
function getDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/** Public hook: active ads for a placement, with centralized realtime + filters */
export function useActiveAds(placement?: string, isVip?: boolean) {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchAds = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      let query = supabase
        .from("advertisements")
        .select("*")
        .eq("active", true)
        .order("priority", { ascending: false })
        .order("sort_order", { ascending: true });

      if (placement) query = query.eq("placement", placement);

      const { data } = await query;
      let results = (data as unknown as Advertisement[]) || [];

      const now = new Date();
      const device = getDevice();
      const isLogged = !!(await supabase.auth.getSession()).data.session;

      results = results.filter((ad) => {
        if (ad.start_at && new Date(ad.start_at) > now) return false;
        if (ad.end_at && new Date(ad.end_at) < now) return false;
        if (ad.max_impressions != null && ad.impressions_count >= ad.max_impressions) return false;
        if (ad.max_clicks != null && ad.clicks_count >= ad.max_clicks) return false;
        if (
          ad.device_targeting?.length &&
          !ad.device_targeting.includes("all") &&
          !ad.device_targeting.includes(device)
        )
          return false;
        if (ad.user_type && ad.user_type !== "all") {
          if (ad.user_type === "guest" && isLogged) return false;
          if (ad.user_type === "logged" && !isLogged) return false;
          if (ad.user_type === "vip" && !isVip) return false;
          if (ad.user_type === "free" && isVip) return false;
        }
        if (isVip && ad.hide_for_vip) return false;
        return true;
      });

      if (mountedRef.current) {
        setAds(results);
      }
    } catch (err) {
      console.error("[useActiveAds] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [placement, isVip]);

  useEffect(() => {
    mountedRef.current = true;
    fetchAds();
    const unsub = realtimeManager.subscribe("ads-live", {
      tables: [{ schema: "public", table: "advertisements" }],
      onChange: fetchAds,
      debounceMs: 500,
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [fetchAds]);

  return { ads, loading, refetch: fetchAds };
}

/** Global master switches, live-synced */
export function useAdGlobalSettings() {
  const [settings, setSettings] = useState<AdGlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const { data } = await supabase
        .from("ad_global_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (mountedRef.current) {
        setSettings((data as unknown as AdGlobalSettings) || null);
      }
    } catch (err) {
      console.error("[useAdGlobalSettings] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const unsub = realtimeManager.subscribe("ad-global-settings", {
      tables: [{ schema: "public", table: "ad_global_settings" }],
      onChange: fetch,
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [fetch]);

  return { settings, loading, refetch: fetch };
}

/** Per-placement intensity overrides */
export function useAdPlacementSettings() {
  const [map, setMap] = useState<Record<string, AdPlacementSetting>>({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const { data } = await (supabase as any)
        .from("ad_placement_settings")
        .select("*");
      const next: Record<string, AdPlacementSetting> = {};
      ((data as AdPlacementSetting[]) || []).forEach((r) => {
        next[r.placement] = r;
      });
      if (mountedRef.current) setMap(next);
    } catch (err) {
      console.error("[useAdPlacementSettings] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const unsub = realtimeManager.subscribe("ad-placement-settings", {
      tables: [{ schema: "public", table: "ad_placement_settings" }],
      onChange: fetch,
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [fetch]);

  return { placementSettings: map, loading, refetch: fetch };
}

export async function upsertPlacementSetting(
  placement: string,
  patch: { intensity?: number; enabled?: boolean; note?: string | null }
) {
  const user = (await supabase.auth.getUser()).data.user;
  const { error } = await (supabase as any)
    .from("ad_placement_settings")
    .upsert(
      {
        placement,
        ...patch,
        updated_by: user?.id ?? null,
      },
      { onConflict: "placement" }
    );
  if (error) throw error;
  await logAdAudit({
    ad_id: null,
    action: "placement_settings",
    reason: `placement=${placement} ${JSON.stringify(patch)}`,
    details: { placement, patch },
  });
}

/** Audit log */
export async function logAdAudit(entry: {
  ad_id: string | null;
  action: string;
  reason?: string | null;
  details?: any;
}) {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    await (supabase as any).from("ad_audit_log").insert({
      ad_id: entry.ad_id,
      actor_id: user?.id ?? null,
      action: entry.action,
      reason: entry.reason ?? null,
      details: entry.details ?? null,
    });
  } catch {
    /* ignore */
  }
}

export function useAdAuditLog(limit = 200) {
  const [entries, setEntries] = useState<AdAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const { data } = await (supabase as any)
        .from("ad_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (mountedRef.current) {
        setEntries((data as AdAuditEntry[]) || []);
      }
    } catch (err) {
      console.error("[useAdAuditLog] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const unsub = realtimeManager.subscribe("ad-audit-log", {
      tables: [{ schema: "public", table: "ad_audit_log" }],
      onChange: fetch,
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [fetch]);

  return { entries, loading, refetch: fetch };
}

/** Fire-and-forget impression/click tracking */
export async function trackAdImpression(adId: string) {
  try {
    await (supabase as any).rpc("increment_ad_impression", { _ad_id: adId });
  } catch {
    /* ignore */
  }
}
export async function trackAdClick(adId: string) {
  try {
    await (supabase as any).rpc("increment_ad_click", { _ad_id: adId });
  } catch {
    /* ignore */
  }
}