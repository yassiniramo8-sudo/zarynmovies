import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, ExternalLink, Languages, Loader2, RefreshCw, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import PlayerControlsOverlay from "@/components/player/PlayerControlsOverlay";

const NativeVideoPlayer = lazy(() => import("./NativeVideoPlayer"));

export type PlayerSourceType = "mp4" | "webm" | "hls" | "dash" | "iframe" | "unknown";

export interface PlayerServer {
  name: string;
  url: string;
  type?: PlayerSourceType | string;
  language?: string;
  quality?: string;
  status?: "active" | "inactive";
  access_level?: "public" | "vip";
}

interface UniversalPlayerProps {
  servers: PlayerServer[];
  storageKey?: string;
  onNext?: () => void;
  onPrev?: () => void;
  className?: string;
}

// Iframe permissions kept in one place. Do not add a sandbox here: several
// external stream providers reject sandboxed embeds and show "Sandbox not allowed".
export const IFRAME_ALLOW =
  "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope; web-share; display-capture; xr-spatial-tracking";

/** Validate a URL string — must be http(s) only. Prevents javascript: / data: XSS. */
export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Auto-detect stream type from URL/extension. */
export function detectSourceType(url: string, hint?: string): PlayerSourceType {
  if (hint) {
    const h = hint.toLowerCase();
    if (["mp4", "webm", "hls", "dash", "iframe"].includes(h)) return h as PlayerSourceType;
  }
  if (!url) return "unknown";
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".mp4")) return "mp4";
  if (clean.endsWith(".webm")) return "webm";
  if (clean.endsWith(".m3u8")) return "hls";
  if (clean.endsWith(".mpd")) return "dash";
  // Common embed hosts → iframe
  if (/(youtube\.com|youtu\.be|vimeo\.com|vidsrc|dood|filemoon|streamwish|mixdrop|voe\.|superembed|embed)/i.test(url)) {
    return "iframe";
  }
  // Fallback: assume iframe embed (most third-party streams are HTML embeds)
  return "iframe";
}

function EmbedIframe({ url, onError }: { url: string; onError: () => void }) {
  // Iframes can't reliably fire onError for X-Frame-Options blocks — a timeout heuristic
  // plus a manual "report" button in the overlay is the honest solution.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
  }, [url]);
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <iframe
        key={url}
        src={url}
        title="Video Player"
        allow={IFRAME_ALLOW}
        allowFullScreen
        referrerPolicy="no-referrer"
        loading="eager"
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full border-0"
      />
    </>
  );
}

function ErrorOverlay({
  message,
  url,
  onRetry,
  onNextServer,
  hasNext,
}: {
  message: string;
  url?: string;
  onRetry?: () => void;
  onNextServer?: () => void;
  hasNext?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm p-6 text-center">
      <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm md:text-base font-medium text-foreground max-w-md">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Retry
          </Button>
        )}
        {hasNext && onNextServer && (
          <Button size="sm" onClick={onNextServer}>
            <SkipForward className="h-4 w-4 mr-1.5" /> Try next server
          </Button>
        )}
        {url && isSafeUrl(url) && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </a>
        )}
      </div>
    </div>
  );
}

function UniversalPlayerInner({ servers, storageKey, onNext, onPrev, className }: UniversalPlayerProps) {
  const activeServers = useMemo(
    () => servers.filter((s) => s.status !== "inactive" && s.url && isSafeUrl(s.url)),
    [servers],
  );

  const initialIndex = useMemo(() => {
    if (!storageKey) return 0;
    try {
      const raw = localStorage.getItem(`up:${storageKey}`);
      const idx = raw != null ? Number(raw) : 0;
      return idx >= 0 && idx < activeServers.length ? idx : 0;
    } catch {
      return 0;
    }
  }, [storageKey, activeServers.length]);

  const [index, setIndex] = useState(initialIndex);
  const [errored, setErrored] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [showLangHelp, setShowLangHelp] = useState(true);
  const failuresRef = useRef<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const active = activeServers[index];
  const sourceType = useMemo(
    () => (active ? detectSourceType(active.url, active.type) : "unknown"),
    [active],
  );

  useEffect(() => {
    setErrored(false);
  }, [index, nonce]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`up:${storageKey}`, String(index));
    } catch {
      /* noop */
    }
  }, [index, storageKey]);

  const tryNext = useCallback(() => {
    failuresRef.current.add(index);
    for (let i = 1; i <= activeServers.length; i++) {
      const next = (index + i) % activeServers.length;
      if (!failuresRef.current.has(next)) {
        setIndex(next);
        return;
      }
    }
    // All servers failed — leave error overlay up.
  }, [index, activeServers.length]);

  const handleError = useCallback(() => {
    setErrored(true);
  }, []);

  const selectServer = useCallback((i: number) => {
    failuresRef.current.delete(i);
    setIndex(i);
  }, []);

  if (!active) {
    return (
      <div className={cn("w-full aspect-video rounded-xl bg-black flex items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">No available servers.</p>
      </div>
    );
  }

  const allFailed = failuresRef.current.size >= activeServers.length && errored;

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* Pre-roll / above-player video ad slot — gated by placement intensity */}
      <AdvertisementRenderer placement="player_video" maxAds={1} />

      <div
        ref={containerRef}
        id="zaryn-player-container"
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border/40 shadow-2xl"
      >
        {sourceType === "iframe" ? (
          <EmbedIframe url={active.url} onError={handleError} />
        ) : sourceType === "unknown" ? (
          <ErrorOverlay
            message="This source type is not supported."
            url={active.url}
            onNextServer={tryNext}
            hasNext={activeServers.length > 1}
          />
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
            <NativeVideoPlayer
              key={`${active.url}-${nonce}`}
              url={active.url}
              type={sourceType as "mp4" | "webm" | "hls" | "dash"}
              onError={handleError}
              onEnded={onNext}
              onPlayingChange={setIsPlaying}
            />
          </Suspense>
        )}

        {/* Custom player controls: Fullscreen & Picture-in-Picture.
            Owned by our website, positioned above every stream type. */}
        <PlayerControlsOverlay containerSelector="#zaryn-player-container" />

        {/* Corner overlay ad — dismissible, gated by placement intensity. */}
        {!overlayDismissed && !errored && (
          <div className="pointer-events-none absolute top-2 left-2 z-20 max-w-[220px]">
            <div className="pointer-events-auto relative rounded-md bg-background/85 backdrop-blur-sm shadow-lg">
              <button
                onClick={() => setOverlayDismissed(true)}
                aria-label="Dismiss overlay ad"
                className="absolute -top-2 -right-2 z-10 rounded-full bg-background border border-border p-0.5 shadow"
              >
                <X className="h-3 w-3" />

              </button>
              <AdvertisementRenderer placement="player_overlay" maxAds={1} />
            </div>
          </div>
        )}

        {/* Pause ad — only shown when the native player is paused */}
        {!isPlaying && !errored && sourceType !== "iframe" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="max-w-md w-[80%]">
              <AdvertisementRenderer placement="player_pause" maxAds={1} />
            </div>
          </div>
        )}

        {/* Bottom banner overlay — dismissible, gated by placement intensity */}
        {!bannerDismissed && !errored && (
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <div className="relative mx-auto max-w-3xl">
              <button
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss banner ad"
                className="absolute -top-2 right-2 z-10 rounded-full bg-background border border-border p-0.5 shadow"
              >
                <X className="h-3 w-3" />
              </button>
              <AdvertisementRenderer placement="player_banner" maxAds={1} />
            </div>
          </div>
        )}

        {errored && (
          <ErrorOverlay
            message={
              allFailed
                ? "All servers failed to load. Please try again later."
                : sourceType === "iframe"
                  ? "This server does not allow embedded playback."
                  : "Playback failed for this source."
            }
            url={active.url}
            onRetry={() => setNonce((n) => n + 1)}
            onNextServer={tryNext}
            hasNext={activeServers.length > 1 && !allFailed}
          />
        )}
      </div>

      {/* Fallback direct-open link */}
      <div className="flex justify-center">
        <a
          href={active.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          If the player doesn't load, click here to watch directly
        </a>
      </div>

      {/* Language help notice — below player, right-aligned */}
      {showLangHelp && (
        <div className="flex justify-end mt-2 px-2">
          <div className="relative bg-muted/50 border border-primary/20 rounded-xl p-3 max-w-[320px] shadow-lg">
            {/* Upward arrow pointing at the player's language icon */}
            <ArrowUp className="absolute -top-2.5 right-4 h-4 w-4 text-primary" />

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => setShowLangHelp(false)}
              aria-label="Dismiss language help"
              className="absolute top-1.5 right-1.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>

            <div className="flex items-start gap-2 pr-4">
              <Languages className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs sm:text-sm font-medium text-foreground">
                  To change the language, click the Languages button above.
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  لتغيير اللغة، اضغط على زر Languages في الأعلى.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server chips */}
      {activeServers.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {activeServers.map((s, i) => {
            const failed = failuresRef.current.has(i);
            return (
              <button
                key={`${s.url}-${i}`}
                onClick={() => selectServer(i)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  i === index
                    ? "border-primary bg-primary/10 text-primary"
                    : failed
                      ? "border-destructive/40 bg-destructive/5 text-destructive/70"
                      : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
                )}
              >
                {s.name || `Server ${i + 1}`}
                {s.quality && <span className="ml-1.5 opacity-70">· {s.quality}</span>}
              </button>
            );
          })}
        </div>
      )}

      {(onPrev || onNext) && (
        <div className="flex justify-between">
          {onPrev ? (
            <Button size="sm" variant="ghost" onClick={onPrev}>
              ← Previous
            </Button>
          ) : (
            <span />
          )}
          {onNext && (
            <Button size="sm" variant="ghost" onClick={onNext}>
              Next → <SkipForward className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export const UniversalPlayer = memo(UniversalPlayerInner);
export default UniversalPlayer;
