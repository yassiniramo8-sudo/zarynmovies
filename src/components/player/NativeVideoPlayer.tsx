import { useEffect, useRef } from "react";
import { emitVideoEvent } from "@/lib/adTrigger";

interface Props {
  url: string;
  type: "mp4" | "webm" | "hls" | "dash";
  onError?: () => void;
  onEnded?: () => void;
  onPlayingChange?: (playing: boolean) => void;
}

/**
 * Native HTML5 video with HLS.js / dash.js attached when needed.
 * Destroys the streaming engine on unmount / source change to avoid memory leaks.
 */
export default function NativeVideoPlayer({ url, type, onError, onEnded, onPlayingChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPercent = useRef(-1);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => {
      onPlayingChange?.(true);
      emitVideoEvent({ kind: "play" });
    };
    const off = () => {
      onPlayingChange?.(false);
      emitVideoEvent({ kind: "pause" });
    };
    const onTime = () => {
      if (!v.duration || !isFinite(v.duration)) return;
      const pct = Math.floor((v.currentTime / v.duration) * 100);
      if (pct !== lastPercent.current && pct >= 0) {
        lastPercent.current = pct;
        emitVideoEvent({ kind: "progress", percent: pct });
      }
    };
    v.addEventListener("play", on);
    v.addEventListener("playing", on);
    v.addEventListener("pause", off);
    v.addEventListener("ended", off);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("play", on);
      v.removeEventListener("playing", on);
      v.removeEventListener("pause", off);
      v.removeEventListener("ended", off);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [onPlayingChange]);



  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let engine: { destroy: () => void } | null = null;

    const attach = async () => {
      try {
        if (type === "hls") {
          // Safari supports HLS natively.
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
          } else {
            const HlsMod = await import("hls.js");
            const Hls = HlsMod.default;
            if (destroyed) return;
            if (Hls.isSupported()) {
              const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
              hls.loadSource(url);
              hls.attachMedia(video);
              hls.on(Hls.Events.ERROR, (_e, data) => {
                if (data.fatal) onError?.();
              });
              engine = hls;
            } else {
              video.src = url;
            }
          }
        } else if (type === "dash") {
          const dashjs = await import("dashjs");
          if (destroyed) return;
          const player = dashjs.MediaPlayer().create();
          player.initialize(video, url, false);
          player.on("error", () => onError?.());
          engine = { destroy: () => player.reset() };
        } else {
          video.src = url;
        }
      } catch {
        onError?.();
      }
    };

    attach();

    return () => {
      destroyed = true;
      try {
        engine?.destroy();
      } catch {
        /* noop */
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [url, type, onError]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full bg-black"
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      onError={onError}
      onEnded={onEnded}
    />
  );
}
