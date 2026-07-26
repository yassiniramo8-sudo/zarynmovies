import { useEffect, useMemo, useRef, useState, useCallback, useSyncExternalStore } from "react";
import {
  useActiveAds,
  useAdGlobalSettings,
  useAdPlacementSettings,
  Advertisement,
  trackAdImpression,
  trackAdClick,
} from "@/hooks/useAdvertisements";
import { useVipStatus } from "@/hooks/useVip";
import { useMyAdSettings } from "@/hooks/useUserAdSettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  getPreview,
  subscribePreview,
  materializePreviewAd,
  isPreviewMode,
} from "@/lib/adPreview";

/** Reactive view of the current preview payload (null when not in preview). */
function useAdPreviewState() {
  return useSyncExternalStore(
    (fn) => subscribePreview(fn),
    () => getPreview(),
    () => null
  );
}


// -------------------- AdSense global init (once) --------------------
let adsenseInitialized = false;
function ensureAdsense() {
  if (adsenseInitialized || typeof window === "undefined") return;
  adsenseInitialized = true;
  // (window as any).adsbygoogle is populated by the AdSense loader script.
  // We do NOT inject the loader script automatically — admins paste the
  // full <script> tag inside the ad HTML. This helper simply guarantees
  // adsbygoogle.push() is called at most once per unit after mount.
  (window as any).adsbygoogle = (window as any).adsbygoogle || [];
}

// Stable per-session seed so ads don't reshuffle on every render.
function sessionSeed(): number {
  if (typeof window === "undefined") return 1;
  const w = window as any;
  if (!w.__adSessionSeed) w.__adSessionSeed = Math.floor(Math.random() * 1e9);
  return w.__adSessionSeed as number;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// Deterministic 0..1 given a key — same value across renders in this session.
function stableRandom(key: string): number {
  return (hash(`${sessionSeed()}:${key}`) % 100000) / 100000;
}

// -------------------- Ad Unit --------------------
function AdUnit({
  ad,
  onClose,
  debug,
  debugReason,
}: {
  ad: Advertisement;
  onClose?: () => void;
  debug?: boolean;
  debugReason?: string;
}) {
  const isRtl = ad.language === "ar";
  const isPopup = ad.ad_type === "popup" || ad.ad_type === "interstitial";
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef(false);
  const adsensePushed = useRef(false);

  // Impression tracking
  useEffect(() => {
    if (!ref.current || seen.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen.current) {
            seen.current = true;
            trackAdImpression(ad.id);
            io.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad.id]);

  // AdSense: push once per unit after mount
  useEffect(() => {
    if (ad.ad_type !== "adsense" || adsensePushed.current) return;
    ensureAdsense();
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      adsensePushed.current = true;
    } catch {
      /* ignore adsense errors */
    }
  }, [ad.ad_type, ad.id]);

  const handleClick = () => trackAdClick(ad.id);

  return (
    <div
      ref={ref}
      dir={isRtl ? "rtl" : "ltr"}
      onClickCapture={handleClick}
      className={cn(
        "ad-unit relative overflow-hidden transition-opacity duration-500",
        isPopup &&
          "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      )}
      data-ad-id={ad.id}
      data-ad-placement={ad.placement}
    >
      {debug && (
        <div className="absolute top-1 left-1 z-10 rounded bg-amber-500/90 text-black text-[10px] font-mono px-1.5 py-0.5 pointer-events-none">
          {ad.placement} · {ad.id.slice(0, 6)} · {ad.active ? "ON" : "OFF"}
          {debugReason ? ` · ${debugReason}` : ""}
        </div>
      )}
      {isPopup && onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 z-10 rounded-full bg-background/80 p-1.5 text-foreground hover:bg-background"
          aria-label="Close ad"
        >
          <X className="h-5 w-5" />
        </button>
      )}
      <div className={cn(isPopup && "relative max-w-lg w-full mx-4")}>
        {ad.image_url && !ad.content_html && (
          <a
            href={ad.link_url || "#"}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="block"
          >
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-full h-auto rounded-md"
              loading="lazy"
            />
          </a>
        )}
        {ad.content_html && (
          <div dangerouslySetInnerHTML={{ __html: ad.content_html }} />
        )}
      </div>
    </div>
  );
}

// -------------------- Debug Placeholder (empty slot) --------------------
function DebugSlot({ placement, reason }: { placement: string; reason: string }) {
  return (
    <div className="my-2 rounded border border-dashed border-amber-500/60 bg-amber-500/5 text-amber-600 text-[11px] font-mono px-2 py-1">
      [ad:{placement}] hidden — {reason}
    </div>
  );
}

// -------------------- Main Renderer --------------------
export interface AdvertisementRendererProps {
  placement: string;
  className?: string;
  maxAds?: number;
  rotate?: boolean;
  rotateInterval?: number;
}

export function AdvertisementRenderer(props: AdvertisementRendererProps) {
  return (
    <ErrorBoundary name="Advertisement" silent>
      <AdvertisementRendererInner {...props} />
    </ErrorBoundary>
  );
}

function AdvertisementRendererInner({
  placement,
  className,
  maxAds,
  rotate = false,
  rotateInterval = 8000,
}: AdvertisementRendererProps) {
  const { isVip, loading: vipLoading } = useVipStatus();
  const { adsEnabled, loading: adSettingsLoading } = useMyAdSettings();
  const { settings, loading: globalLoading } = useAdGlobalSettings();
  const { placementSettings, loading: placementLoading } = useAdPlacementSettings();
  const { ads, loading } = useActiveAds(placement, isVip);
  const { language } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // ---- LIVE PREVIEW SHORT-CIRCUIT ----
  const preview = useAdPreviewState();
  const inPreview = isPreviewMode();
  if (inPreview) {
    // "Preview as VIP" hides every ad slot everywhere.
    if (preview?.userType === "vip") {
      return (
        <div className={cn("ad-container my-2", className)}>
          <div className="rounded border border-dashed border-emerald-500/50 bg-emerald-500/5 text-emerald-600 text-[11px] font-mono px-2 py-1">
            [ad:{placement}] hidden — VIP visitor (no ads)
          </div>
        </div>
      );
    }
    if (preview && preview.ad.placement === placement) {
      const ad = materializePreviewAd(preview);
      return (
        <div className={cn("ad-container my-4 relative", className)}>
          <div className="absolute -top-2 left-2 z-10 rounded bg-primary text-primary-foreground text-[10px] font-mono px-1.5 py-0.5 shadow">
            PREVIEW · {placement}
          </div>
          <AdUnit ad={ad} debug={false} />
        </div>
      );
    }
    // In preview mode but not the target placement — render nothing so the
    // page layout stays clean and only the preview slot stands out.
    return null;
  }


  const debug = !!settings?.debug_mode;
  const globalIntensity = settings?.ad_intensity ?? 50;
  const placementOverride = placementSettings[placement];
  // Per-placement override takes precedence over the global slider.
  // A placement can also be fully disabled independent of ad state.
  const placementEnabled = placementOverride ? placementOverride.enabled : true;
  const intensity = placementOverride ? placementOverride.intensity : globalIntensity;


  // Language + dismissed filter
  const langFiltered = useMemo(
    () =>
      ads.filter(
        (a) =>
          (a.language === "all" || a.language === language) &&
          !dismissed.has(a.id)
      ),
    [ads, language, dismissed]
  );

  // Intensity gate — deterministic per (placement + session)
  const intensityAllows = useMemo(() => {
    if (intensity >= 100) return true;
    if (intensity <= 0) return false;
    const r = stableRandom(`intensity:${placement}`) * 100;
    return r < intensity;
  }, [placement, intensity]);

  // Sort by priority DESC; pick a rotating slice, capped by maxAds
  const shown = useMemo(() => {
    if (!intensityAllows) return [] as Advertisement[];
    const sorted = [...langFiltered].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );
    const seededSorted = sorted
      .map((a) => ({
        a,
        k: (a.priority || 0) * 1000 + stableRandom(`rot:${a.id}`) * 999,
      }))
      .sort((x, y) => y.k - x.k)
      .map((x) => x.a);
    return maxAds ? seededSorted.slice(0, maxAds) : seededSorted;
  }, [langFiltered, maxAds, intensityAllows]);

  // Rotation timer
  useEffect(() => {
    if (!rotate || shown.length <= 1) return;
    const t = setInterval(() => {
      setCurrentIndex((p) => (p + 1) % shown.length);
    }, rotateInterval);
    return () => clearInterval(t);
  }, [rotate, shown.length, rotateInterval]);

  useEffect(() => {
    if (currentIndex >= shown.length) setCurrentIndex(0);
  }, [shown.length, currentIndex]);

  const handleDismiss = useCallback((adId: string) => {
    setDismissed((prev) => new Set(prev).add(adId));
  }, []);

  if (loading || vipLoading || adSettingsLoading || globalLoading || placementLoading) return null;

  // Reason resolution for debug
  let hiddenReason: string | null = null;
  if (!settings) hiddenReason = "no global settings";
  else if (settings.emergency_hide) hiddenReason = "emergency hide";
  else if (!settings.ads_enabled) hiddenReason = "master OFF";
  else if (isVip) hiddenReason = "user is VIP";
  else if (!adsEnabled) hiddenReason = "user ads disabled";
  else if (!placementEnabled) hiddenReason = "placement disabled";
  else if (!intensityAllows)
    hiddenReason = `intensity ${intensity}%${placementOverride ? " (placement)" : ""} skipped`;
  else if (langFiltered.length === 0) hiddenReason = "no active ads for placement";

  if (hiddenReason) {
    return debug ? <DebugSlot placement={placement} reason={hiddenReason} /> : null;
  }

  if (shown.length === 0) {
    return debug ? (
      <DebugSlot placement={placement} reason="nothing to render" />
    ) : null;
  }

  if (rotate && shown.length > 1) {
    const ad = shown[currentIndex % shown.length];
    return (
      <div className={cn("ad-container my-4", className)}>
        <AdUnit
          key={ad.id}
          ad={ad}
          debug={debug}
          onClose={
            ad.ad_type === "popup" || ad.ad_type === "interstitial"
              ? () => handleDismiss(ad.id)
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={cn("ad-container my-4", className)}>
      {shown.map((ad) => (
        <AdUnit
          key={ad.id}
          ad={ad}
          debug={debug}
          onClose={
            ad.ad_type === "popup" || ad.ad_type === "interstitial"
              ? () => handleDismiss(ad.id)
              : undefined
          }
        />
      ))}
    </div>
  );
}

// Back-compat alias so existing <AdDisplay /> usage keeps working.
export const AdDisplay = AdvertisementRenderer;
export default AdvertisementRenderer;
