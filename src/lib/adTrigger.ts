/**
 * Timed & Triggered Advertisements — shared config, storage and helpers.
 *
 * Storage strategy:
 *  - `localStorage` under `zaryn_timed_ads` stores { [adId]: { lastShown, count } }
 *    to enforce hourly / 6h / 12h / 24h / once-ever / every-x-minutes / pageview quotas.
 *  - `sessionStorage` under `zaryn_timed_ads_session` stores an id -> true map for
 *    "once-per-session" frequency.
 *  - `sessionStorage.zaryn_pageview_count` accumulates pageviews for "every-x-pageviews".
 */

export type TriggerKind =
  | "delay"
  | "scroll"
  | "video-play"
  | "video-pause"
  | "video-progress"
  | "page-end"
  | "exit-intent";

export type DisplayMode =
  | "center"
  | "floating-card"
  | "bottom-popup"
  | "top-notification"
  | "slide-left"
  | "slide-right"
  | "fullscreen"
  | "player-overlay"
  | "corner-floating";

export type FrequencyKind =
  | "once-ever"
  | "once-per-session"
  | "hourly"
  | "every-6h"
  | "every-12h"
  | "every-24h"
  | "every-x-pageviews"
  | "every-x-minutes";

export interface TriggerConfig {
  enabled?: boolean;
  trigger?: TriggerKind;
  delaySeconds?: number;
  scrollPercent?: number;
  videoPercent?: number;
  displayMode?: DisplayMode;
  countdownSeconds?: number;
  autoCloseSeconds?: number;
  closeButtonLockSeconds?: number;
  frequency?: FrequencyKind;
  frequencyValue?: number;
}

export const DEFAULT_TRIGGER: TriggerConfig = {
  enabled: false,
  trigger: "delay",
  delaySeconds: 10,
  scrollPercent: 50,
  videoPercent: 20,
  displayMode: "center",
  countdownSeconds: 0,
  autoCloseSeconds: 0,
  closeButtonLockSeconds: 0,
  frequency: "once-per-session",
  frequencyValue: 5,
};

const LS_KEY = "zaryn_timed_ads";
const SS_KEY = "zaryn_timed_ads_session";
const PV_KEY = "zaryn_pageview_count";

interface HistoryEntry {
  lastShown: number;
  count: number;
}

function readHistory(): Record<string, HistoryEntry> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeHistory(h: Record<string, HistoryEntry>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(h));
  } catch {
    /* quota */
  }
}

function sessionSet(id: string) {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    const set = raw ? JSON.parse(raw) : {};
    set[id] = true;
    sessionStorage.setItem(SS_KEY, JSON.stringify(set));
  } catch {
    /* ignore */
  }
}

function sessionHas(id: string): boolean {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? !!JSON.parse(raw)[id] : false;
  } catch {
    return false;
  }
}

export function incrementPageview(): number {
  try {
    const n = parseInt(sessionStorage.getItem(PV_KEY) || "0", 10) + 1;
    sessionStorage.setItem(PV_KEY, String(n));
    return n;
  } catch {
    return 1;
  }
}

export function getPageviewCount(): number {
  try {
    return parseInt(sessionStorage.getItem(PV_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

/** Returns true if the ad is allowed to be shown right now under its frequency rule. */
export function canShow(adId: string, cfg: TriggerConfig): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const history = readHistory();
  const h = history[adId];
  const freq = cfg.frequency || "once-per-session";
  const val = Math.max(1, cfg.frequencyValue || 1);

  switch (freq) {
    case "once-ever":
      return !h;
    case "once-per-session":
      return !sessionHas(adId);
    case "hourly":
      return !h || now - h.lastShown >= 60 * 60 * 1000;
    case "every-6h":
      return !h || now - h.lastShown >= 6 * 60 * 60 * 1000;
    case "every-12h":
      return !h || now - h.lastShown >= 12 * 60 * 60 * 1000;
    case "every-24h":
      return !h || now - h.lastShown >= 24 * 60 * 60 * 1000;
    case "every-x-minutes":
      return !h || now - h.lastShown >= val * 60 * 1000;
    case "every-x-pageviews": {
      const pv = getPageviewCount();
      if (!h) return pv >= val;
      return pv - (h.count || 0) >= val;
    }
  }
}

/** Record that the ad was shown so future frequency checks respect it. */
export function markShown(adId: string) {
  const now = Date.now();
  const history = readHistory();
  history[adId] = {
    lastShown: now,
    count: getPageviewCount(),
  };
  writeHistory(history);
  sessionSet(adId);
}

/** Parse config regardless of whether the DB row stored a JSON string or object. */
export function parseTriggerConfig(raw: unknown): TriggerConfig {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as TriggerConfig;
    } catch {
      return {};
    }
  }
  return raw as TriggerConfig;
}

/* -------- Video event bus (used by NativeVideoPlayer) -------- */

export type VideoEvent =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "progress"; percent: number };

const VIDEO_EVENT = "zaryn:video-event";

export function emitVideoEvent(e: VideoEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VIDEO_EVENT, { detail: e }));
}

export function onVideoEvent(fn: (e: VideoEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: Event) => fn((ev as CustomEvent<VideoEvent>).detail);
  window.addEventListener(VIDEO_EVENT, handler);
  return () => window.removeEventListener(VIDEO_EVENT, handler);
}
