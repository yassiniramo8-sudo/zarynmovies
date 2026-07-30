import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * AdPlacement — Universal Dynamic Ad Container
 * ============================================
 *
 * A resilient client component that safely renders any ad snippet:
 *   - Static HTML banners
 *   - Direct `<script src="...">` tags (Adsterra / Monetag / AdSense)
 *   - Inline `<script>...</script>` blocks
 *   - Popunders & Social Bars
 *
 * Key guarantees:
 *  1. Scripts inside `dangerouslySetInnerHTML` are NOT executed by React.
 *     We parse the HTML, extract every `<script>` node, and re-create it
 *     as a real `HTMLScriptElement` so the browser actually runs it.
 *  2. If script evaluation throws (CSP, sandbox, etc.), we fall back to an
 *     isolated iframe sandbox so the ad still has a chance to render.
 *  3. A skeleton placeholder reserves vertical space so the page never
 *     layout-shifts (CLS) while the ad loads or when no ad is returned.
 *  4. A responsive flex wrapper centers the ad and clips overflow on mobile.
 *  5. All injected elements (iframes, images, ins) are constrained to
 *     max-width: 100% so fixed-size ads scale down on small viewports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AdSize =
  | "300x250"
  | "728x90"
  | "320x50"
  | "160x600"
  | "300x600"
  | "970x250"
  | "responsive"
  | "fluid";

export interface AdPlacementProps {
  /** Raw HTML / script snippet from the dashboard DB. */
  html?: string | null;
  /** Optional children rendered when no `html` is provided. */
  children?: ReactNode;
  /** Fixed size preset — reserves skeleton height to avoid CLS. */
  size?: AdSize;
  /** Extra class names on the outer wrapper. */
  className?: string;
  /** Inline style overrides on the outer wrapper. */
  style?: CSSProperties;
  /** Minimum height (px) for the skeleton when `size` is responsive/fluid. */
  minHeight?: number;
  /** Show a subtle "Advertisement" label above the slot. */
  showLabel?: boolean;
  /** When true, render inside an isolated iframe sandbox. */
  sandbox?: boolean;
  /** Unique key so the same snippet can be re-injected on change. */
  nonce?: string | number;
  /** Called after the ad HTML has been injected. */
  onInject?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Size presets -> skeleton height                                    */
/* ------------------------------------------------------------------ */

const SIZE_HEIGHTS: Record<AdSize, number> = {
  "300x250": 250,
  "728x90": 90,
  "320x50": 50,
  "160x600": 600,
  "300x600": 600,
  "970x250": 250,
  responsive: 120,
  fluid: 100,
};

const SIZE_MAX_WIDTH: Record<AdSize, string> = {
  "300x250": "300px",
  "728x90": "728px",
  "320x50": "320px",
  "160x600": "160px",
  "300x600": "300px",
  "970x250": "970px",
  responsive: "100%",
  fluid: "100%",
};

/* ------------------------------------------------------------------ */
/*  Script execution helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Extract all <script> nodes from an HTML string, returning the cleaned
 * HTML (scripts removed) plus a list of script descriptors.
 *
 * Scripts are NOT modified — the original variable names (e.g. `atOptions`)
 * are preserved exactly as the ad network expects them.
 */
function extractScripts(html: string): {
  htmlWithoutScripts: string;
  scripts: Array<{ src?: string; content?: string; attrs: Record<string, string> }>;
} {
  if (typeof window === "undefined") {
    return { htmlWithoutScripts: html, scripts: [] };
  }
  const template = document.createElement("template");
  template.innerHTML = html;

  const scripts: Array<{ src?: string; content?: string; attrs: Record<string, string> }> = [];
  const scriptNodes = Array.from(template.content.querySelectorAll("script"));

  for (const node of scriptNodes) {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(node.attributes)) {
      attrs[attr.name] = attr.value;
    }
    scripts.push({
      src: node.src || undefined,
      content: node.textContent || undefined,
      attrs,
    });
    node.remove();
  }

  return { htmlWithoutScripts: template.innerHTML, scripts };
}

/**
 * Create a real, executable `<script>` element and append it to `container`.
 * The script is created as a fresh `HTMLScriptElement` so the browser
 * actually downloads and executes it (React's dangerouslySetInnerHTML
 * does NOT execute script content).
 *
 * All original attributes and variable names (atOptions, etc.) are
 * preserved exactly as provided by the ad network.
 *
 * Returns true if the script was appended without throwing.
 */
function appendScript(
  container: HTMLElement,
  script: { src?: string; content?: string; attrs: Record<string, string> }
): boolean {
  try {
    const el = document.createElement("script");
    // Copy all original attributes (async, defer, type, data-*, etc.)
    for (const [name, value] of Object.entries(script.attrs)) {
      try {
        el.setAttribute(name, value);
      } catch {
        /* ignore bad attrs */
      }
    }
    if (script.src) {
      el.src = script.src;
    } else if (script.content) {
      el.text = script.content;
    }
    // Force async if not explicitly set, to avoid blocking hydration.
    if (!script.attrs.async && !script.attrs.defer && script.src) {
      el.async = true;
    }
    container.appendChild(el);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[AdPlacement] script append failed:", err);
    return false;
  }
}

/**
 * Inject HTML + scripts into a container safely.
 * Returns `{ ok, fallback }` — `fallback` is true if every script failed.
 *
 * The raw HTML is rendered exactly as provided — no variable names are
 * rewritten, ensuring full compatibility with all ad networks.
 */
function injectAdHTML(container: HTMLElement, html: string): {
  ok: boolean;
  fallback: boolean;
} {
  const { htmlWithoutScripts, scripts } = extractScripts(html);

  // 1) Set non-script HTML first (banners, iframes, divs, etc.).
  container.innerHTML = htmlWithoutScripts;

  // 2) Re-create each script as a real element so it executes.
  //    All original variable names (atOptions, etc.) are preserved.
  let successCount = 0;
  for (const s of scripts) {
    if (appendScript(container, s)) successCount++;
  }

  const allFailed = scripts.length > 0 && successCount === 0;
  return { ok: successCount === scripts.length, fallback: allFailed };
}

/* ------------------------------------------------------------------ */
/*  Iframe sandbox fallback                                            */
/* ------------------------------------------------------------------ */

/**
 * When direct script injection fails (CSP / sandbox / cross-origin), render
 * the snippet inside a sandboxed iframe so it has its own document context.
 */
function AdIframeSandbox({ html, minHeight }: { html: string; minHeight: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    setLoaded(false);

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
        body{display:flex;justify-content:center;align-items:center;min-height:${minHeight}px;}
        *{max-width:100%;}
      </style></head><body>${html}</body></html>`);
    doc.close();
    setLoaded(true);
  }, [html, minHeight]);

  return (
    <iframe
      ref={ref}
      title="ad-sandbox"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
      scrolling="no"
      style={{
        width: "100%",
        minHeight,
        border: 0,
        background: "transparent",
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton placeholder                                               */
/* ------------------------------------------------------------------ */

function AdSkeleton({ height, className }: { height: number; className?: string }) {
  return (
    <div
      className={cn(
        "ad-skeleton w-full rounded-md bg-muted/40 animate-pulse",
        className
      )}
      style={{ height }}
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Inner injector (uses useEffect, never during hydration)           */
/* ------------------------------------------------------------------ */

function AdInjector({
  html,
  sandbox,
  minHeight,
  onInject,
}: {
  html: string;
  sandbox?: boolean;
  minHeight: number;
  onInject?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) {
      setStatus("ready");
      return;
    }

    // Clear any previous content.
    container.innerHTML = "";
    setStatus("loading");

    // Defer one tick so React finishes its commit before we mutate the DOM.
    const id = window.requestAnimationFrame(() => {
      try {
        const result = injectAdHTML(container, html);
        if (result.fallback || (sandbox && result.ok === false)) {
          setStatus("fallback");
        } else {
          setStatus("ready");
        }
        onInject?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[AdPlacement] inject error, using iframe fallback:", err);
        setStatus("fallback");
      }
    });

    return () => window.cancelAnimationFrame(id);
  }, [html, sandbox, minHeight, onInject]);

  if (status === "fallback") {
    return <AdIframeSandbox html={html} minHeight={minHeight} />;
  }

  return (
    <div
      ref={containerRef}
      className="ad-injected-content w-full"
      style={{ minHeight: status === "loading" ? minHeight : undefined }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AdPlacement({
  html,
  children,
  size = "responsive",
  className,
  style,
  minHeight,
  showLabel = false,
  sandbox = false,
  nonce,
  onInject,
}: AdPlacementProps) {
  const skeletonHeight = minHeight ?? SIZE_HEIGHTS[size] ?? 120;
  const [hasContent, setHasContent] = useState(false);

  // Detect whether there's anything to render.
  useEffect(() => {
    setHasContent(!!(html && html.trim()) || !!children);
  }, [html, children]);

  const handleInject = useCallback(() => {
    onInject?.();
  }, [onInject]);

  // Outer wrapper: full-width flex container that centers its child.
  // The inner wrapper uses width: fit-content so it auto-expands to
  // the ad's native dimensions (e.g. 728px for a 728x90 banner) without
  // being capped at a preset max-width that would clip larger units.
  // On mobile, max-width: 100% ensures fixed-size ads scale down.
  const wrapperStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    margin: "20px auto",
    ...style,
  };

  const innerStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: hasContent ? skeletonHeight : undefined,
  };

  return (
    <ErrorBoundary name="AdPlacement" silent>
      <div className={cn("ad-placement-wrapper", className)} style={wrapperStyle}>
        {showLabel && hasContent && (
          <span className="block text-center text-[10px] uppercase tracking-wider text-muted-foreground/60 select-none mb-1">
            Advertisement
          </span>
        )}

        {/* Skeleton reserves space until content arrives. */}
        {!hasContent && <AdSkeleton height={skeletonHeight} />}

        {/* Actual ad content — inner container auto-sizes to ad dimensions. */}
        {hasContent && (
          <div className="ad-placement-content" style={innerStyle} key={nonce}>
            {html && html.trim() ? (
              <AdInjector
                html={html}
                sandbox={sandbox}
                minHeight={skeletonHeight}
                onInject={handleInject}
              />
            ) : (
              children
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default AdPlacement;