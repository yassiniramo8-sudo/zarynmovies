import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle, ExternalLink, Loader2, X } from "lucide-react";

interface TrailerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trailerUrl: string;
  title: string;
  /**
   * Optional content ID — reserved for future use.
   * Not used for any autoembed/source generation.
   */
  contentId?: string;
}

/**
 * Extract a YouTube video ID from any common URL format.
 */
function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (/^youtu\.be$/i.test(u.hostname)) {
      const raw = u.pathname.replace(/^\/+/, "").split("/")[0];
      return raw.length >= 11 ? raw.slice(0, 11) : null;
    }
    if (/^(www\.|m\.)?youtube\.com$/i.test(u.hostname)) {
      const path = u.pathname.replace(/\/+$/, "");
      if (path.startsWith("/watch")) {
        const v = u.searchParams.get("v");
        return v ? v.slice(0, 11) : null;
      }
      if (/^\/(shorts|v|embed)\//.test(path)) {
        const seg = path.split("/")[2];
        return seg ? seg.slice(0, 11) : null;
      }
      const segs = path.split("/").filter(Boolean);
      if (segs.length === 1 && segs[0].length >= 11) return segs[0].slice(0, 11);
    }
  } catch { /* pass */ }
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

function buildYoutubeEmbedUrl(videoId: string): string {
  const origin = window.location.origin;
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(origin)}&rel=0`;
}

/**
 * YouTube-only trailer modal.
 *
 *   Has YouTube URL → play via youtube-nocookie.com embed
 *   Embed blocked    → "This trailer cannot be embedded." + "Watch on YouTube"
 *   No trailer URL   → "No trailer available."
 *   Direct MP4/WebM  → native <video> element
 */
export function TrailerModal({
  open,
  onOpenChange,
  trailerUrl,
  title,
}: TrailerModalProps) {
  const [phase, setPhase] = useState<"loading" | "playing" | "failed">("loading");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Reset on open/close. Dialog unmounts content when closed → no leaks.
  useEffect(() => {
    if (open) {
      setPhase("loading");
    } else {
      clearTimer();
      setPhase("loading");
    }
    return clearTimer;
  }, [open]);

  // Fallback timer: if iframe doesn't fire onLoad within 6 s, show fallback UI.
  useEffect(() => {
    clearTimer();
    if (phase === "loading" && open) {
      timerRef.current = setTimeout(() => setPhase("failed"), 6000);
    }
    return clearTimer;
  }, [phase, open]);

  // ── No trailer URL at all ──
  if (!trailerUrl) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border-border/50 gap-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
            <span className="text-sm font-medium text-foreground truncate pr-4">
              {title} — Trailer
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="aspect-video w-full bg-black relative flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No trailer available.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const videoId = extractYoutubeId(trailerUrl);
  const isDirect = isDirectVideo(trailerUrl);
  const embedUrl = videoId ? buildYoutubeEmbedUrl(videoId) : null;
  const watchOnYoutubeUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : trailerUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border-border/50 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
          <span className="text-sm font-medium text-foreground truncate pr-4">
            {title} — Trailer
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close trailer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="aspect-video w-full bg-black relative">
          {/* ── Direct MP4 / WebM ── */}
          {isDirect ? (
            <video
              src={trailerUrl}
              autoPlay
              controls
              playsInline
              className="w-full h-full"
            />
          ) : embedUrl && phase !== "failed" ? (
            /* ── YouTube embed ── */
            <>
              {phase === "loading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={`${title} — Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                loading="eager"
                className="w-full h-full border-0 z-0"
                onLoad={() => {
                  setPhase("playing");
                  clearTimer();
                }}
                onError={() => {
                  setPhase("failed");
                  clearTimer();
                }}
              />
            </>
          ) : (
            /* ── Fallback: blocked / unsupported ── */
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/90 backdrop-blur-sm p-6 text-center">
              <div className="h-16 w-16 rounded-full border-2 border-amber-500/30 flex items-center justify-center bg-amber-500/10">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <div>
                <p className="text-base md:text-lg font-semibold text-white">
                  This trailer cannot be embedded.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The video may be restricted from playing here.
                </p>
              </div>
              <a
                href={watchOnYoutubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-500 hover:shadow-red-500/30 active:scale-95"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14z" />
                </svg>
                Play Trailer in New Tab
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}