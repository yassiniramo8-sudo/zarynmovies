import { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PlayerControlsOverlayProps {
  /** CSS selector targeting the player container DOM element for Fullscreen. */
  containerSelector: string;
  className?: string;
}

/**
 * Custom player overlay controls that belong to the website — not the stream.
 *
 * - Fullscreen: requests browser fullscreen on the player container element.
 * - Picture-in-Picture: activates PiP on the native <video> element inside the
 *   container. If the current source is an iframe embed, the button shows
 *   "This streaming server does not support Picture-in-Picture" on click.
 *
 * Styled with modern glass-morphism: rounded, backdrop-blur, glow on hover.
 * Visible on all screen sizes with a high z-index so it never hides behind
 * third-party iframes.
 */
export default function PlayerControlsOverlay({
  containerSelector,
  className,
}: PlayerControlsOverlayProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track browser fullscreen state so the icon toggles correctly.
  useEffect(() => {
    const onFsChange = () => {
      const el = document.querySelector(containerSelector);
      setIsFullscreen(document.fullscreenElement === el);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [containerSelector]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const el = document.querySelector(containerSelector) as HTMLElement | null;
      if (!el) {
        toast.error("Player container not found.");
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (typeof el.requestFullscreen === "function") {
        await el.requestFullscreen();
      } else {
        toast.error("Fullscreen is not supported in this browser.");
      }
    } catch {
      toast.error("Could not enter fullscreen mode.");
    }
  }, [containerSelector]);

  const toggleLandscapeFullscreen = useCallback(async () => {
    try {
      const el = document.querySelector(containerSelector) as HTMLElement | null;
      if (!el) {
        toast.error("Player container not found.");
        return;
      }
      // Request fullscreen on the player container
      if (!document.fullscreenElement && typeof el.requestFullscreen === "function") {
        await el.requestFullscreen();
      }
      // Lock screen orientation to landscape (mobile/tablets)
      if (screen.orientation && typeof screen.orientation.lock === "function") {
        await screen.orientation.lock("landscape").catch(() => {});
      }
    } catch {
      toast.error("Could not enter landscape fullscreen mode.");
    }
  }, [containerSelector]);

  return (
    <div
      className={cn(
        "absolute top-2 right-2 z-50 flex items-center gap-1.5",
        className,
      )}
    >
      {/* Landscape fullscreen button (forces orientation lock) */}
      <button
        type="button"
        onClick={toggleLandscapeFullscreen}
        aria-label="Landscape fullscreen"
        title="Landscape fullscreen"
        className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-primary/60 hover:bg-black/60 hover:shadow-[0_0_18px_-4px_hsl(var(--primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <RotateCw className="h-4 w-4 transition-transform group-hover:scale-110" />
      </button>

      {/* Fullscreen button */}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-primary/60 hover:bg-black/60 hover:shadow-[0_0_18px_-4px_hsl(var(--primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4 transition-transform group-hover:scale-110" />
        ) : (
          <Maximize2 className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
