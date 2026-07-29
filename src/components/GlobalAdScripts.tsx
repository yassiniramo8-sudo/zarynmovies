import { useEffect, useRef } from "react";
import { useVipStatus } from "@/hooks/useVip";
import { useMyAdSettings } from "@/hooks/useUserAdSettings";
import { useAdGlobalSettings } from "@/hooks/useAdvertisements";

/**
 * GlobalAdScripts — Global Script Integration for Ad Networks
 * ============================================================
 *
 * Loads third-party ad network scripts (Social Bar, Popunder, Auto-ads)
 * that must run globally on every page, not inside a specific placement.
 *
 * Strategies (analogous to next/script):
 *   - "afterInteractive": Load as soon as the page is interactive (default).
 *   - "lazyOnload": Load during browser idle time.
 *   - "beforeInteractive": Load in <head> before hydration (use sparingly).
 *
 * The component respects VIP status, master ad toggle, and user ad settings
 * so global scripts are never injected for users who shouldn't see ads.
 */

export interface GlobalScriptDefinition {
  /** Unique ID for deduplication. */
  id: string;
  /** Script URL (src). */
  src: string;
  /** Inline script content (used when src is empty). */
  content?: string;
  /** Loading strategy. */
  strategy?: "afterInteractive" | "lazyOnload" | "beforeInteractive";
  /** Extra attributes to set on the script element. */
  attrs?: Record<string, string>;
}

interface GlobalAdScriptsProps {
  /** Array of global script definitions to load. */
  scripts?: GlobalScriptDefinition[];
}

/* ------------------------------------------------------------------ */
/*  Script loader helpers                                              */
/* ------------------------------------------------------------------ */

const loadedScripts = new Set<string>();

function injectScript(
  def: GlobalScriptDefinition,
  onLoad?: () => void,
  onError?: () => void
): HTMLScriptElement | null {
  const scriptId = `global-ad-script-${def.id}`;

  // Deduplicate: skip if already injected.
  if (document.getElementById(scriptId)) return null;

  const el = document.createElement("script");
  el.id = scriptId;

  // Apply extra attributes.
  if (def.attrs) {
    for (const [key, value] of Object.entries(def.attrs)) {
      el.setAttribute(key, value);
    }
  }

  if (def.src) {
    el.src = def.src;
    el.async = true;
    if (onLoad) el.onload = onLoad;
    if (onError) el.onerror = onError;
  } else if (def.content) {
    el.text = def.content;
  }

  // Determine where to append based on strategy.
  if (def.strategy === "beforeInteractive") {
    document.head.appendChild(el);
  } else {
    document.body.appendChild(el);
  }

  loadedScripts.add(def.id);
  return el;
}

function removeScript(id: string) {
  const el = document.getElementById(`global-ad-script-${id}`);
  if (el) el.remove();
  loadedScripts.delete(id);
}

/* ------------------------------------------------------------------ */
/*  Lazy loader (idle callback / rIC fallback)                        */
/* ------------------------------------------------------------------ */

function loadWhenIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fn, { timeout: 5000 });
  } else {
    setTimeout(fn, 2000);
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function GlobalAdScripts({ scripts = [] }: GlobalAdScriptsProps) {
  const { isVip, loading: vipLoading } = useVipStatus();
  const { adsEnabled, loading: adSettingsLoading } = useMyAdSettings();
  const { settings, loading: globalLoading } = useAdGlobalSettings();
  const injectedRef = useRef(false);

  const shouldBlock =
    vipLoading ||
    adSettingsLoading ||
    globalLoading ||
    isVip ||
    !adsEnabled ||
    !settings?.ads_enabled ||
    settings?.emergency_hide;

  useEffect(() => {
    // If ads are suppressed, remove any previously injected global scripts.
    if (shouldBlock) {
      if (injectedRef.current) {
        scripts.forEach((s) => removeScript(s.id));
        injectedRef.current = false;
      }
      return;
    }

    if (injectedRef.current) return;
    injectedRef.current = true;

    for (const def of scripts) {
      if (def.strategy === "lazyOnload") {
        loadWhenIdle(() => injectScript(def));
      } else {
        // "afterInteractive" (default) or "beforeInteractive"
        injectScript(def);
      }
    }

    return () => {
      // Cleanup on unmount.
      scripts.forEach((s) => removeScript(s.id));
      injectedRef.current = false;
    };
  }, [shouldBlock, scripts]);

  return null;
}

export default GlobalAdScripts;