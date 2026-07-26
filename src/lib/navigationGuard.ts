/**
 * Navigation Guard — blocks iframe-initiated history.back() / history.go(-1)
 * calls without affecting legitimate user back-navigation through browser chrome.
 *
 * External stream providers (DoodStream, etc.) embed scripts that detect mobile
 * viewports and call `window.top.history.back()` to break out of iframes.
 * Because our <iframe> must not carry a sandbox (most providers reject it),
 * we guard the History API at the application level.
 *
 * Browser back button clicks and swipe gestures do NOT invoke these JS methods;
 * they trigger popstate directly at the browser engine level.
 * Therefore, monkey-patching the JS API blocks only programmatic (attacker) calls.
 */

let guarded = false;

/** Set to true while a detail page with stream iframes is mounted. */
let detailPageActive = false;

/**
 * Path-based fallback for the race condition on sub-200ms mobile loads.
 * The iframe can fire location.href before setDetailPageActive(true) runs.
 * This regex catches any /movies/:id, /anime/:id, or /series/:id path
 * as a secondary gate when the flag hasn't been set yet.
 */
const DETAIL_PATH = /\/((?:ar|en|fr|es|de|pt|ja)\/)?(movies|anime|series)\/[^/]+$/;
function isOnDetailPage(): boolean {
  if (detailPageActive) return true;
  try { return DETAIL_PATH.test(window.location.pathname); } catch { return false; }
}

/** Snapshot of body className and inline styles before the detail page mounted. */
let bodySnapshot: { className: string; cssText: string } | null = null;

/** Whitelisted body classes that must always be preserved. */
const BODY_SAFE_CLASSES = ["dark", "light"];
/** Blacklisted classes that iframe scripts inject to break the layout. */
const BODY_FORBIDDEN_CLASSES = [
  "fixed", "min-h-screen", "justify-center",
  "backdrop-blur", "backdrop-blur-sm", "backdrop-blur-md", "backdrop-blur-xl",
];
/** Style properties that iframe scripts corrupt — these are force-reset. */
const BODY_FORBIDDEN_STYLES = [
  "overflow", "overflowX", "overflowY",
  "position", "height", "minHeight", "width", "minWidth", "maxWidth",
  "inset", "top", "left", "right", "bottom",
  "margin", "marginTop", "padding",
];

let bodyObserver: MutationObserver | null = null;

export function setDetailPageActive(active: boolean) {
  if (active === detailPageActive) return;
  detailPageActive = active;
  if (active) {
    // Snapshot current body state before iframes can corrupt it
    bodySnapshot = {
      className: document.body.className,
      cssText: document.body.style.cssText,
    };
    startBodyObserver();
  } else {
    stopBodyClassObserver();
    restoreBodySnapshot();
  }
}

/** Force-restore body to pre-detail-page state on unmount. */
function restoreBodySnapshot() {
  if (!bodySnapshot) return;
  const body = document.body;
  // Restore className, keeping only safe classes from snapshot
  const savedClasses = bodySnapshot.className.split(/\s+/).filter(Boolean);
  const safeFromSaved = BODY_SAFE_CLASSES.filter((c) => savedClasses.includes(c));
  const currentSafe = BODY_SAFE_CLASSES.filter((c) => body.className.split(/\s+/).includes(c));
  const mergedSafe = [...new Set([...safeFromSaved, ...currentSafe])];
  body.className = mergedSafe.join(" ");
  // Restore inline styles
  body.style.cssText = bodySnapshot.cssText;
  bodySnapshot = null;
}

/**
 * Protect the <body> element from iframe-injected classes AND inline styles.
 * DoodStream etc. inject "fixed min-h-screen backdrop-blur-xl" as classes
 * AND set style.overflow = "hidden" / style.position = "fixed" which persist
 * after navigation and freeze the entire page layout.
 */
function startBodyObserver() {
  if (bodyObserver) return;
  bodyObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") {
        const body = document.body;
        if (m.attributeName === "class") {
          const classes = body.className.split(/\s+/);
          const cleaned = classes.filter(
            (c) => !BODY_FORBIDDEN_CLASSES.includes(c)
          );
          const safeClasses = BODY_SAFE_CLASSES.filter((c) => !cleaned.includes(c));
          if (safeClasses.length > 0 || cleaned.length !== classes.length) {
            const final = [...cleaned, ...safeClasses];
            bodyObserver?.disconnect();
            document.body.className = final.join(" ");
            reattachBodyObserver();
          }
        }
        if (m.attributeName === "style") {
          // Strip forbidden inline styles set by iframe scripts
          let changed = false;
          for (const prop of BODY_FORBIDDEN_STYLES) {
            if (body.style.getPropertyValue(prop)) {
              body.style.removeProperty(prop);
              changed = true;
            }
          }
          if (changed) {
            bodyObserver?.disconnect();
            body.style.setProperty("overflow-x", "hidden"); // restore base overflow-x
            reattachBodyObserver();
          }
        }
      }
    }
  });
  reattachBodyObserver();
}

function reattachBodyObserver() {
  if (!bodyObserver) return;
  bodyObserver.disconnect();
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
}

function stopBodyClassObserver() {
  bodyObserver?.disconnect();
  bodyObserver = null;
}

/** Call once at app boot — patch all iframe-exploitable navigation APIs. */
export function installNavigationGuard() {
  if (guarded) return;
  guarded = true;

  // --- Layer 0: beforeunload — bulletproof fallback for location.href setter ---
  // Chromium does NOT expose the native href setter to JavaScript
  // (Object.getOwnPropertyDescriptor returns undefined), so the prototype
  // patch below cannot intercept window.top.location.href = url.
  // Instead we listen for beforeunload — fired by real page navigations
  // (location.href / location.replace / form submit) but NOT by React
  // Router's history.pushState. Cancel the event while on a detail page.
  window.addEventListener("beforeunload", function detailGuardBeforeUnload(e: BeforeUnloadEvent) {
    if (isOnDetailPage()) {
      console.warn("[Zaryn] beforeunload blocked — iframe-initiated page navigation.");
      e.preventDefault();
      e.returnValue = "" as any; // legacy compat
    }
  });

  try {
    // --- Layer 1: Block history.back() / history.go(-1) ---
    const originalBack = window.history.back.bind(window.history);
    const originalGo = window.history.go.bind(window.history);

    window.history.back = function () {
      if (isOnDetailPage()) {
        console.warn("[Zaryn] history.back() blocked — likely iframe-initiated.");
        return;
      }
      originalBack();
    };

    window.history.go = function (delta?: number) {
      if (isOnDetailPage() && delta !== undefined && delta < 0) {
        console.warn("[Zaryn] history.go(" + delta + ") blocked — likely iframe-initiated.");
        return;
      }
      originalGo(delta);
    };

    // --- Layer 2: Block location.replace / location.assign via prototype ---
    const locationProto = Object.getPrototypeOf(window.location);

    const replaceDesc = Object.getOwnPropertyDescriptor(locationProto, "replace");
    const assignDesc = Object.getOwnPropertyDescriptor(locationProto, "assign");

    if (replaceDesc?.value) {
      const originalReplace = replaceDesc.value;
      Object.defineProperty(locationProto, "replace", {
        value(url: string | URL) {
          if (isOnDetailPage()) {
            console.warn("[Zaryn] location.replace(" + String(url) + ") blocked.");
            return;
          }
          originalReplace.call(window.location, url);
        },
        configurable: true, writable: true,
      });
    }

    if (assignDesc?.value) {
      const originalAssign = assignDesc.value;
      Object.defineProperty(locationProto, "assign", {
        value(url: string | URL) {
          if (isOnDetailPage()) {
            console.warn("[Zaryn] location.assign(" + String(url) + ") blocked.");
            return;
          }
          originalAssign.call(window.location, url);
        },
        configurable: true, writable: true,
      });
    }
  } catch (err) {
    console.error("[Zaryn] Navigation guard install failed.", err);
  }
}
