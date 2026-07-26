/**
 * Live Advertisement Preview bus.
 *
 * Runs in TWO contexts:
 *  - The admin dashboard (parent window): calls `pushPreview()` to broadcast
 *    the ad-being-edited to every open preview iframe.
 *  - The site itself when opened with `?__adPreview=1` (child iframe):
 *    `initPreviewFromWindow()` bootstraps a subscription that lets
 *    `AdvertisementRenderer` inject the preview ad at the target placement,
 *    bypassing all normal gates (VIP, intensity, DB, targeting).
 *
 * Nothing touches the live database — the preview ad exists only in memory.
 */
import type { Advertisement } from "@/hooks/useAdvertisements";

export type PreviewUserType = "guest" | "logged" | "vip" | "admin";
export type PreviewTheme = "dark" | "light";

export interface AdPreviewPayload {
  ad: Partial<Advertisement> & {
    placement: string;
    ad_type: string;
    title: string;
  };
  userType: PreviewUserType;
  theme: PreviewTheme;
  /** Unique id per preview session for cache-busting */
  nonce: string;
}

const STORAGE_KEY = "__zaryn_ad_preview_v1";
const MSG_UPDATE = "AD_PREVIEW_UPDATE";
const MSG_READY = "AD_PREVIEW_READY";

let current: AdPreviewPayload | null = null;
const listeners = new Set<(s: AdPreviewPayload | null) => void>();

export function getPreview(): AdPreviewPayload | null {
  return current;
}

export function subscribePreview(fn: (s: AdPreviewPayload | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setLocal(s: AdPreviewPayload | null) {
  current = s;
  listeners.forEach((fn) => fn(s));
}

/** Parent (dashboard): push a preview payload to every open preview iframe. */
export function pushPreview(iframe: HTMLIFrameElement | null, payload: AdPreviewPayload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
  iframe?.contentWindow?.postMessage({ type: MSG_UPDATE, state: payload }, "*");
}

export function isPreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("__adPreview");
}

/**
 * Called once from `main.tsx`. When the site is loaded inside the preview
 * iframe, subscribe to postMessage updates and apply theme immediately.
 */
export function initPreviewFromWindow() {
  if (typeof window === "undefined" || !isPreviewMode()) return;

  // Try to hydrate from sessionStorage first (survives soft nav).
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) setLocal(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  applyTheme(current?.theme);

  window.addEventListener("message", (e: MessageEvent) => {
    const data = e.data as { type?: string; state?: AdPreviewPayload };
    if (!data || data.type !== MSG_UPDATE) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.state));
    } catch {
      /* ignore */
    }
    applyTheme(data.state?.theme);
    setLocal(data.state ?? null);
  });

  // Tell parent we're mounted so it can push initial state after navigation.
  try {
    window.parent?.postMessage({ type: MSG_READY }, "*");
  } catch {
    /* ignore */
  }
}

function applyTheme(theme: PreviewTheme | undefined) {
  if (typeof document === "undefined") return;
  if (theme === "dark") document.documentElement.classList.add("dark");
  else if (theme === "light") document.documentElement.classList.remove("dark");
}

/**
 * Synthesize a full `Advertisement` from the partial preview payload so the
 * renderer can treat it identically to a real DB row.
 */
export function materializePreviewAd(payload: AdPreviewPayload): Advertisement {
  const a = payload.ad;
  return {
    id: `preview-${payload.nonce}`,
    title: a.title || "(preview)",
    ad_type: a.ad_type,
    placement: a.placement,
    content_html: a.content_html ?? null,
    image_url: a.image_url ?? null,
    link_url: a.link_url ?? null,
    target_pages: [],
    target_content_id: null,
    target_content_type: null,
    sort_order: 0,
    active: true,
    hide_for_vip: false,
    language: (a.language as string) || "all",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    start_at: null,
    end_at: null,
    priority: 9999,
    device_targeting: ["all"],
    user_type: "all",
    max_impressions: null,
    max_clicks: null,
    impressions_count: 0,
    clicks_count: 0,
    ab_group: null,
  };
}

export const AD_PREVIEW_MSG = { UPDATE: MSG_UPDATE, READY: MSG_READY } as const;
