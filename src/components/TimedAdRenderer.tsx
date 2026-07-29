import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { useVipStatus } from "@/hooks/useVip";
import { useMyAdSettings } from "@/hooks/useUserAdSettings";
import {
  useAdGlobalSettings,
  Advertisement,
  trackAdImpression,
  trackAdClick,
} from "@/hooks/useAdvertisements";
import {
  parseTriggerConfig,
  TriggerConfig,
  canShow,
  markShown,
  onVideoEvent,
  incrementPageview,
} from "@/lib/adTrigger";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { AdPlacement } from "@/components/AdPlacement";
import { isPreviewMode, subscribePreview, getPreview, materializePreviewAd } from "@/lib/adPreview";
import { useSyncExternalStore } from "react";

/**
 * Global mounter for advertisements that appear on a trigger:
 *   - after a delay
 *   - after scroll %
 *   - on video play / pause / X% progress
 *   - on reaching page end
 *   - on exit-intent (desktop)
 *
 * Renders as overlays outside the page flow (portal-free — fixed positioning),
 * respecting the ad's `display_mode`, countdown, auto-close and close-button lock.
 */
export function TimedAdRenderer() {
  const { isVip, loading: vipLoading } = useVipStatus();
  const { adsEnabled, loading: adSetLoading } = useMyAdSettings();
  const { settings, loading: settingsLoading } = useAdGlobalSettings();
  const { language } = useLanguage();
  const location = useLocation();

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Bump pageview counter on route change (used by frequency rules)
  useEffect(() => {
    incrementPageview();
  }, [location.pathname]);

  // Fetch active timed ads (any ad with trigger_config.enabled = true)
  useEffect(() => {
    if (isPreviewMode()) return;
    let cancelled = false;
    const fetchAds = async () => {
      try {
        const { data } = await supabase
          .from("advertisements")
          .select("*")
          .eq("active", true)
          .order("priority", { ascending: false });
        if (cancelled) return;
        const rows = ((data as unknown as Advertisement[]) || []).filter((a) => {
          const cfg = parseTriggerConfig((a as any).trigger_config);
          return !!cfg.enabled;
        });
        setAds(rows);
        setLoaded(true);
      } catch (err) {
        console.error("[TimedAdRenderer] fetchAds failed:", err);
        if (!cancelled) setLoaded(true);
      }
    };
    fetchAds();
    const unsub = realtimeManager.subscribe("timed-ads", {
      tables: [{ schema: "public", table: "advertisements" }],
      onChange: () => fetchAds(),
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const eligible = useMemo(() => {
    if (!loaded) return [];
    if (!settings || settings.emergency_hide || !settings.ads_enabled) return [];
    if (isVip || !adsEnabled) return [];
    const now = new Date();
    return ads.filter((a) => {
      if (a.language !== "all" && a.language !== language) return false;
      if (a.start_at && new Date(a.start_at) > now) return false;
      if (a.end_at && new Date(a.end_at) < now) return false;
      if (a.max_impressions != null && a.impressions_count >= a.max_impressions) return false;
      if (a.user_type && a.user_type !== "all") {
        if (a.user_type === "vip" && !isVip) return false;
        if (a.user_type === "free" && isVip) return false;
      }
      if (isVip && a.hide_for_vip) return false;
      return true;
    });
  }, [ads, loaded, settings, isVip, adsEnabled, language]);

  // Preview mode: render the in-memory preview ad if its trigger is enabled,
  // so admins see the exact countdown / trigger / mode behavior before publishing.
  const preview = useSyncExternalStore(
    (fn) => subscribePreview(fn),
    () => getPreview(),
    () => null
  );
  if (isPreviewMode()) {
    if (!preview) return null;
    const cfg = parseTriggerConfig((preview.ad as any).trigger_config);
    if (!cfg.enabled) return null;
    const ad = materializePreviewAd(preview);
    return <TriggeredAd key={`preview-${preview.nonce}`} ad={ad} previewBypassFrequency />;
  }

  if (vipLoading || adSetLoading || settingsLoading) return null;

  return (
    <>
      {eligible.map((ad) => (
        <TriggeredAd key={ad.id} ad={ad} />
      ))}
    </>
  );
}

/* ============ single triggered ad instance ============ */

function TriggeredAd({ ad, previewBypassFrequency }: { ad: Advertisement; previewBypassFrequency?: boolean }) {
  const cfg = useMemo(() => parseTriggerConfig((ad as any).trigger_config), [ad]);
  const [phase, setPhase] = useState<"waiting" | "countdown" | "visible" | "closed">("waiting");
  const [countdown, setCountdown] = useState<number>(cfg.countdownSeconds ?? 0);
  const [closeLockLeft, setCloseLockLeft] = useState<number>(cfg.closeButtonLockSeconds ?? 0);
  const armed = useRef(false);
  const impressionTracked = useRef(false);

  // Fire the trigger → move to countdown (or straight to visible if no countdown)
  const trigger = () => {
    if (armed.current) return;
    if (!previewBypassFrequency && !canShow(ad.id, cfg)) return;
    armed.current = true;
    if ((cfg.countdownSeconds ?? 0) > 0) {
      setCountdown(cfg.countdownSeconds!);
      setPhase("countdown");
    } else {
      show();
    }
  };

  const show = () => {
    setPhase("visible");
    if (!previewBypassFrequency) markShown(ad.id);
    if (!impressionTracked.current) {
      impressionTracked.current = true;
      trackAdImpression(ad.id);
    }
    if ((cfg.closeButtonLockSeconds ?? 0) > 0) {
      setCloseLockLeft(cfg.closeButtonLockSeconds!);
    }
  };

  // Countdown tick
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      show();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Close-button lock tick
  useEffect(() => {
    if (phase !== "visible" || closeLockLeft <= 0) return;
    const t = setTimeout(() => setCloseLockLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, closeLockLeft]);

  // Auto-close
  useEffect(() => {
    if (phase !== "visible") return;
    const secs = cfg.autoCloseSeconds ?? 0;
    if (secs <= 0) return;
    const t = setTimeout(() => setPhase("closed"), secs * 1000);
    return () => clearTimeout(t);
  }, [phase, cfg.autoCloseSeconds]);

  // Wire up the actual trigger source
  useEffect(() => {
    if (phase !== "waiting") return;

    const kind = cfg.trigger ?? "delay";

    if (kind === "delay") {
      const t = setTimeout(trigger, Math.max(0, (cfg.delaySeconds ?? 10) * 1000));
      return () => clearTimeout(t);
    }

    if (kind === "scroll") {
      const target = Math.max(1, Math.min(100, cfg.scrollPercent ?? 50));
      const onScroll = () => {
        const doc = document.documentElement;
        const scrolled =
          (window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight)) * 100;
        if (scrolled >= target) trigger();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (kind === "page-end") {
      const onScroll = () => {
        const doc = document.documentElement;
        const remaining = doc.scrollHeight - window.innerHeight - window.scrollY;
        if (remaining < 40) trigger();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (kind === "exit-intent") {
      // Desktop only — a coarse "hover" check keeps this off touch devices.
      if (window.matchMedia?.("(hover: none)").matches) return;
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) trigger();
      };
      document.addEventListener("mouseleave", onLeave);
      return () => document.removeEventListener("mouseleave", onLeave);
    }

    if (kind === "video-play" || kind === "video-pause" || kind === "video-progress") {
      const target = Math.max(1, Math.min(100, cfg.videoPercent ?? 20));
      return onVideoEvent((e) => {
        if (kind === "video-play" && e.kind === "play") trigger();
        if (kind === "video-pause" && e.kind === "pause") trigger();
        if (kind === "video-progress" && e.kind === "progress" && e.percent >= target)
          trigger();
      });
    }
  }, [phase, cfg]);

  if (phase === "closed") return null;

  if (phase === "countdown") {
    return (
      <div className="fixed bottom-4 right-4 z-[9998] rounded-full bg-background/90 border border-border shadow-lg px-4 py-2 text-sm font-mono">
        Ad in {countdown}s…
      </div>
    );
  }

  if (phase !== "visible") return null;

  return (
    <TimedAdShell
      mode={cfg.displayMode ?? "center"}
      canClose={closeLockLeft <= 0}
      closeLockLeft={closeLockLeft}
      onClose={() => setPhase("closed")}
    >
      <AdBody
        ad={ad}
        onClick={() => trackAdClick(ad.id)}
      />
    </TimedAdShell>
  );
}

/* ---------- Ad body (image/HTML) ---------- */

function AdBody({ ad, onClick }: { ad: Advertisement; onClick: () => void }) {
  return (
    <div onClickCapture={onClick} className="w-full">
      {ad.image_url && !ad.content_html && (
        <a
          href={ad.link_url || "#"}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="block"
        >
          <img src={ad.image_url} alt={ad.title} className="w-full h-auto rounded-md" loading="lazy" />
        </a>
      )}
      {ad.content_html && (
        <AdPlacement
          html={ad.content_html}
          size="responsive"
          minHeight={100}
        />
      )}
    </div>
  );
}

/* ---------- Display-mode shell ---------- */

function TimedAdShell({
  mode,
  onClose,
  canClose,
  closeLockLeft,
  children,
}: {
  mode: string;
  onClose: () => void;
  canClose: boolean;
  closeLockLeft: number;
  children: React.ReactNode;
}) {
  // Backdrop only for modal-style modes
  const modal = mode === "center" || mode === "fullscreen";

  const containerClass = (() => {
    switch (mode) {
      case "center":
        return "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 animate-fade-in";
      case "fullscreen":
        return "fixed inset-0 z-[9999] flex items-center justify-center bg-background animate-fade-in";
      case "bottom-popup":
        return "fixed inset-x-0 bottom-0 z-[9998] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-fade-in";
      case "top-notification":
        return "fixed inset-x-0 top-0 z-[9998] p-3 pt-[max(0.75rem,env(safe-area-inset-top))] animate-fade-in";
      case "slide-left":
        return "fixed left-3 bottom-3 z-[9998] animate-slide-in-right";
      case "slide-right":
        return "fixed right-3 bottom-3 z-[9998] animate-slide-in-right";
      case "corner-floating":
        return "fixed right-3 bottom-3 z-[9998] animate-fade-in";
      case "player-overlay":
        return "fixed inset-x-0 bottom-0 z-[9998] pointer-events-none";
      case "floating-card":
      default:
        return "fixed right-4 bottom-4 z-[9998] animate-fade-in";
    }
  })();

  const cardClass = (() => {
    switch (mode) {
      case "center":
        return "relative max-w-md w-full rounded-xl bg-card text-card-foreground shadow-2xl border border-border overflow-hidden animate-scale-in";
      case "fullscreen":
        return "relative w-full h-full flex items-center justify-center p-6";
      case "bottom-popup":
      case "top-notification":
        return "mx-auto max-w-2xl rounded-xl bg-card text-card-foreground shadow-xl border border-border overflow-hidden";
      case "slide-left":
      case "slide-right":
      case "floating-card":
      case "corner-floating":
        return "max-w-xs w-[300px] rounded-xl bg-card text-card-foreground shadow-xl border border-border overflow-hidden";
      case "player-overlay":
        return "mx-auto max-w-3xl rounded-t-xl bg-card/95 text-card-foreground shadow-xl border border-border overflow-hidden pointer-events-auto";
      default:
        return "rounded-xl bg-card shadow-xl border border-border overflow-hidden";
    }
  })();

  return (
    <div
      className={containerClass}
      onClick={modal ? (canClose ? onClose : undefined) : undefined}
    >
      <div className={cn(cardClass)} onClick={(e) => e.stopPropagation()}>
        <div className="relative p-3">
          {canClose ? (
            <button
              onClick={onClose}
              className="absolute top-1.5 right-1.5 z-10 rounded-full bg-background/80 hover:bg-background p-1 text-foreground"
              aria-label="Close ad"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <div className="absolute top-1.5 right-1.5 z-10 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {closeLockLeft}s
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export default TimedAdRenderer;
