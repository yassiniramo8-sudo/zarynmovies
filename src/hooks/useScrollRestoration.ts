import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "zaryn_scroll_positions";

interface ScrollPositionMap {
  [key: string]: number;
}

function readPositions(): ScrollPositionMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePositions(map: ScrollPositionMap) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage unavailable — ignore
  }
}

/**
 * Global scroll restoration hook.
 *
 * - Saves `window.scrollY` into `sessionStorage` keyed by `location.key`
 *   on every scroll event (throttled) and on navigation.
 * - On POP (back/forward) navigation, restores the saved position after
 *   the target page has had a chance to render (uses requestAnimationFrame
 *   + a short delay to let lazy-loaded content mount).
 * - On PUSH/REPLACE navigation, scrolls to top (new page).
 */
export function useScrollRestoration() {
  const location = useLocation();
  const prevKeyRef = useRef<string | null>(null);
  const isPopRef = useRef(false);

  // Detect POP vs PUSH via history.state
  useLayoutEffect(() => {
    const onPopState = () => {
      isPopRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Save scroll position on scroll (throttled via rAF)
  useLayoutEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const map = readPositions();
        map[location.key] = window.scrollY;
        writePositions(map);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.key]);

  // Save position when leaving the current route
  useLayoutEffect(() => {
    const map = readPositions();
    if (prevKeyRef.current) {
      map[prevKeyRef.current] = window.scrollY;
      writePositions(map);
    }
    prevKeyRef.current = location.key;
  }, [location.key]);

  // Restore or scroll-to-top on route change — useLayoutEffect runs BEFORE paint
  useLayoutEffect(() => {
    const isPop = isPopRef.current;
    isPopRef.current = false;

    if (isPop) {
      // Back/forward: restore saved position after content mounts
      const saved = readPositions()[location.key];
      if (typeof saved === "number" && saved > 0) {
        const restore = () => {
          window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior });
        };
        // Attempt 1: immediately (before paint)
        restore();
        // Attempt 2: after first frame (lazy content may mount)
        const raf = requestAnimationFrame(() => restore());
        // Attempt 3-6: progressively later (data fetching may complete)
        const timers = [50, 150, 300, 600].map((ms) =>
          window.setTimeout(() => restore(), ms)
        );
        return () => {
          cancelAnimationFrame(raf);
          timers.forEach((t) => window.clearTimeout(t));
        };
      }
      // No saved position — scroll to top
      window.scrollTo(0, 0);
    } else {
      // PUSH/REPLACE: new page, scroll to top
      window.scrollTo(0, 0);
    }
  }, [location.key, location.pathname]);

  // Clean up body styles (keep existing iframe-leak protection)
  useLayoutEffect(() => {
    const body = document.body;
    body.style.overflow = "";
    body.style.overflowX = "";
    body.style.overflowY = "";
    body.style.position = "";
    body.style.height = "";
    body.style.minHeight = "";
    body.style.width = "";
    body.style.minWidth = "";
    body.style.maxWidth = "";
    body.style.inset = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.bottom = "";
    body.style.margin = "";
    body.style.marginTop = "";
    body.style.padding = "";
  }, [location.pathname]);
}