import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VipDoodPlayerProps {
  url: string;
  onFallback: () => void;
}

/**
 * VIP-only clean player for Doodstream sources.
 * Calls the `doodstream-extract` edge function to obtain a direct stream URL,
 * then plays it in a native <video> element — no external iframe, no ads.
 * If extraction fails, calls onFallback so the caller can render the shielded iframe.
 */
export function VipDoodPlayer({ url, onFallback }: VipDoodPlayerProps) {
  const [direct, setDirect] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    setDirect(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("doodstream-extract", {
          body: { url },
        });
        if (cancelled) return;
        if (error || !data?.direct) {
          onFallback();
          return;
        }
        setDirect(data.direct as string);
      } catch {
        if (!cancelled) onFallback();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, onFallback]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white/70">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs">Preparing clean VIP stream…</span>
      </div>
    );
  }

  if (errored || !direct) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white/70">
        <AlertCircle className="h-8 w-8 text-destructive/80" />
        <span className="text-xs">Stream unavailable</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      key={direct}
      src={direct}
      autoPlay
      controls
      playsInline
      crossOrigin="anonymous"
      className="absolute inset-0 h-full w-full bg-black object-contain"
      onError={() => {
        setErrored(true);
        onFallback();
      }}
    />
  );
}
