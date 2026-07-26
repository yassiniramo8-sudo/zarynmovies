import { useEffect } from "react";
import { useVipStatus } from "@/hooks/useVip";
import { useMyAdSettings } from "@/hooks/useUserAdSettings";

/**
 * Strong client-side ad blocker for VIP users and users with ads disabled
 * from the admin panel. Runs independently of any browser extension so it
 * never conflicts with the site's own adblock-enforcement wall.
 *
 * - Injects CSS to hide common ad selectors (including AdSense, our own
 *   .ad-unit / .ad-container blocks, and popular ad network wrappers).
 * - Uses a MutationObserver to remove ad iframes/scripts injected at runtime.
 * - Neutralizes window.adsbygoogle so AdSense loaders become no-ops.
 */
const AD_SELECTORS = [
  ".ad-unit",
  ".ad-container",
  ".adsbygoogle",
  "ins.adsbygoogle",
  "[data-ad-client]",
  "[data-ad-slot]",
  "[id^='google_ads_']",
  "[id^='div-gpt-ad']",
  "iframe[src*='googlesyndication']",
  "iframe[src*='doubleclick.net']",
  "iframe[src*='adservice.google']",
  "iframe[src*='ads.']",
  "iframe[id*='google_ads']",
  "script[src*='googlesyndication']",
  "script[src*='doubleclick.net']",
  "script[src*='adservice.google']",
];

const AD_SCRIPT_HOSTS = [
  "googlesyndication",
  "doubleclick.net",
  "adservice.google",
  "adsystem",
  "adnxs.com",
  "taboola",
  "outbrain",
  "propellerads",
  "popads",
];

const STYLE_ID = "vip-adblocker-style";

export function VipAdBlocker() {
  const { isVip, loading: vipLoading } = useVipStatus();
  const { adsEnabled, loading: adLoading } = useMyAdSettings();

  const active = !vipLoading && !adLoading && (isVip || !adsEnabled);

  useEffect(() => {
    if (!active) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }

    // 1) Global CSS hiding rule
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `${AD_SELECTORS.join(",")}{display:none!important;visibility:hidden!important;height:0!important;width:0!important;pointer-events:none!important;}`;
      document.head.appendChild(style);
    }

    // 2) Neutralize AdSense queue
    try {
      (window as any).adsbygoogle = {
        push: () => {},
        loaded: true,
      };
    } catch {}

    // 3) Strip existing ad nodes
    const strip = (root: ParentNode) => {
      AD_SELECTORS.forEach((sel) => {
        root.querySelectorAll(sel).forEach((n) => n.remove());
      });
    };
    strip(document);

    // 4) Observe and remove future ad nodes
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const src = (node as HTMLScriptElement | HTMLIFrameElement).src || "";
          if (
            node.tagName === "SCRIPT" &&
            AD_SCRIPT_HOSTS.some((h) => src.includes(h))
          ) {
            node.remove();
            return;
          }
          if (
            node.tagName === "IFRAME" &&
            AD_SCRIPT_HOSTS.some((h) => src.includes(h))
          ) {
            node.remove();
            return;
          }
          if (AD_SELECTORS.some((sel) => node.matches?.(sel))) {
            node.remove();
            return;
          }
          if (node.querySelectorAll) strip(node);
        });
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [active]);

  return null;
}
