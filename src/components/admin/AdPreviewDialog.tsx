import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  RotateCcw,
  Tv,
  Moon,
  Sun,
  RefreshCw,
  Columns,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  AD_PREVIEW_MSG,
  AdPreviewPayload,
  PreviewTheme,
  PreviewUserType,
  pushPreview,
} from "@/lib/adPreview";

// ---------- Device presets (CSS px, portrait unless noted) ----------
type DeviceKey =
  | "tv"
  | "desktop"
  | "laptop"
  | "tablet"
  | "phone"
  | "phone_landscape";

const DEVICES: Record<
  DeviceKey,
  { label: string; w: number; h: number; icon: React.ComponentType<any> }
> = {
  tv: { label: "TV (1920)", w: 1920, h: 1080, icon: Tv },
  desktop: { label: "Desktop (1440)", w: 1440, h: 900, icon: Monitor },
  laptop: { label: "Laptop (1280)", w: 1280, h: 800, icon: Laptop },
  tablet: { label: "Tablet (768)", w: 768, h: 1024, icon: Tablet },
  phone: { label: "Phone (390)", w: 390, h: 844, icon: Smartphone },
  phone_landscape: {
    label: "Phone landscape (844)",
    w: 844,
    h: 390,
    icon: Smartphone,
  },
};

// ---------- Placement -> preview route resolver ----------
type ResolvedRoutes = {
  firstMovieId?: string;
  firstSeriesId?: string;
  firstAnimeId?: string;
  firstNewsId?: string;
  firstArticleId?: string;
};

async function fetchResolverIds(): Promise<ResolvedRoutes> {
  const [m, s, a, n, ar] = await Promise.all([
    supabase.from("movies").select("id").limit(1).maybeSingle(),
    supabase.from("series").select("id").limit(1).maybeSingle(),
    supabase.from("anime").select("id").limit(1).maybeSingle(),
    supabase.from("sports_news").select("id").limit(1).maybeSingle(),
    supabase.from("articles").select("id").limit(1).maybeSingle(),
  ]);
  return {
    firstMovieId: (m.data as any)?.id,
    firstSeriesId: (s.data as any)?.id,
    firstAnimeId: (a.data as any)?.id,
    firstNewsId: (n.data as any)?.id,
    firstArticleId: (ar.data as any)?.id,
  };
}

function routeForPlacement(placement: string, r: ResolvedRoutes): string {
  const p = placement;
  if (
    p.startsWith("home_") ||
    p === "header" ||
    p === "footer" ||
    p === "sidebar" ||
    p.startsWith("sticky_") ||
    p === "popup" ||
    p === "floating" ||
    p === "between_cards" ||
    p === "movies_list" ||
    p === "search_results" ||
    p === "category_page" ||
    p === "inline"
  )
    return "/";
  if (p === "series_list") return "/series";
  if (p === "anime_list") return "/anime";
  if (p === "news_list") return "/news";
  if (p === "articles_list") return "/articles";
  if (p === "profile") return "/profile";
  if (
    p.startsWith("movie_detail") ||
    p === "above_player" ||
    p === "below_player" ||
    p.startsWith("player_") ||
    p === "between_episodes" ||
    p === "related_movies"
  ) {
    if (r.firstMovieId) return `/movies/${r.firstMovieId}`;
    if (r.firstSeriesId) return `/series/${r.firstSeriesId}`;
    if (r.firstAnimeId) return `/anime/${r.firstAnimeId}`;
    return "/";
  }
  if (p === "inside_article" || p === "after_paragraph" || p === "before_comments") {
    if (r.firstArticleId) return `/articles/${r.firstArticleId}`;
    if (r.firstNewsId) return `/news/${r.firstNewsId}`;
    return "/articles";
  }
  return "/";
}

// ---------- Validation ----------
export interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
}

export function validateAd(ad: AdPreviewPayload["ad"]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const html = ad.content_html || "";
  const img = ad.image_url || "";

  if (!html && !img)
    issues.push({ level: "error", message: "No HTML and no image — nothing to render." });

  if (html) {
    // Broken tag balance (very rough)
    const opens = (html.match(/<[a-z][a-z0-9]*[^>]*>/gi) || []).length;
    const closes = (html.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
    const selfClosing = (html.match(/<[a-z][a-z0-9]*[^>]*\/>/gi) || []).length;
    if (opens - selfClosing - closes > 2)
      issues.push({ level: "warning", message: "HTML looks unbalanced — check open/close tags." });

    if (/<script[^>]*>[\s\S]*?<\/script>/i.test(html) === false && ad.ad_type === "adsense")
      issues.push({
        level: "warning",
        message: "AdSense ad type without a <script> tag — code may be incomplete.",
      });

    if (ad.ad_type === "adsense" && !/adsbygoogle/i.test(html))
      issues.push({
        level: "warning",
        message: "AdSense code does not mention `adsbygoogle` — likely incomplete.",
      });

    if (/<iframe[^>]*>/i.test(html)) {
      const srcMatch = html.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
      if (!srcMatch) issues.push({ level: "warning", message: "Iframe without a src attribute." });
      else if (srcMatch[1].startsWith("http://"))
        issues.push({
          level: "warning",
          message: "Iframe uses http:// — will be blocked as mixed content on https sites.",
        });
    }

    if (/http:\/\//.test(html))
      issues.push({
        level: "warning",
        message: "Ad HTML references http:// resources — will trigger mixed-content warnings.",
      });

    if (html.length > 50_000)
      issues.push({
        level: "warning",
        message: `HTML is very large (${(html.length / 1024).toFixed(0)} KB) — may hurt page performance.`,
      });
  }

  if (img) {
    try {
      const u = new URL(img);
      if (u.protocol === "http:")
        issues.push({
          level: "warning",
          message: "Image URL is http:// — mixed content will block it.",
        });
    } catch {
      issues.push({ level: "error", message: "Image URL is not a valid absolute URL." });
    }
  }

  return issues;
}

// ---------- The dialog ----------
export interface AdPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  ad: AdPreviewPayload["ad"];
  onPublish?: () => void;
  publishLabel?: string;
  onSaveDraft?: () => void;
  showActions?: boolean;
}

export function AdPreviewDialog({
  open,
  onClose,
  ad,
  onPublish,
  publishLabel = "Publish",
  onSaveDraft,
  showActions = true,
}: AdPreviewDialogProps) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [theme, setTheme] = useState<PreviewTheme>("dark");
  const [userType, setUserType] = useState<PreviewUserType>("guest");
  const [compare, setCompare] = useState(false);
  const [resolver, setResolver] = useState<ResolvedRoutes>({});
  const [nonce, setNonce] = useState(() => Math.random().toString(36).slice(2, 10));
  const [showIssues, setShowIssues] = useState(true);
  const iframeARef = useRef<HTMLIFrameElement | null>(null);
  const iframeBRef = useRef<HTMLIFrameElement | null>(null);

  const route = useMemo(
    () => routeForPlacement(ad.placement, resolver),
    [ad.placement, resolver]
  );
  const previewUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${route}?__adPreview=1&_t=${nonce}`;
  }, [route, nonce]);
  const liveUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${route}`;
  }, [route]);

  const issues = useMemo(() => validateAd(ad), [ad]);
  const errors = issues.filter((i) => i.level === "error");

  const payload: AdPreviewPayload = useMemo(
    () => ({ ad, userType, theme, nonce }),
    [ad, userType, theme, nonce]
  );

  // Resolve first-content ids once when opened
  useEffect(() => {
    if (!open) return;
    fetchResolverIds().then(setResolver);
  }, [open]);

  // Push payload updates to iframe A on every dep change
  useEffect(() => {
    if (!open) return;
    pushPreview(iframeARef.current, payload);
  }, [payload, open]);

  // When iframe signals READY (after navigation), push again
  useEffect(() => {
    if (!open) return;
    const onMsg = (e: MessageEvent) => {
      if ((e.data as any)?.type === AD_PREVIEW_MSG.READY) {
        pushPreview(iframeARef.current, payload);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [open, payload]);

  const reload = () => setNonce(Math.random().toString(36).slice(2, 10));

  const d = DEVICES[device];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Live Preview — {ad.title || "(untitled)"}
            </DialogTitle>
            <Badge variant="outline">{ad.placement}</Badge>
            <Badge variant="outline">{ad.ad_type}</Badge>
            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
              on <code>{route}</code>
            </span>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Device */}
            <ToggleGroup
              type="single"
              value={device}
              onValueChange={(v) => v && setDevice(v as DeviceKey)}
              className="flex-wrap"
            >
              {(Object.keys(DEVICES) as DeviceKey[]).map((k) => {
                const Icon = DEVICES[k].icon;
                return (
                  <ToggleGroupItem key={k} value={k} className="h-8 px-2" title={DEVICES[k].label}>
                    <Icon className="h-4 w-4" />
                    <span className="ml-1 hidden md:inline text-xs">
                      {DEVICES[k].label.split(" ")[0]}
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>

            <div className="h-6 w-px bg-border mx-1" />

            {/* Theme */}
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4 mr-1" /> Dark
            </Button>
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4 mr-1" /> Light
            </Button>

            <div className="h-6 w-px bg-border mx-1" />

            {/* User type */}
            <Label className="text-xs text-muted-foreground">Preview as</Label>
            <Select value={userType} onValueChange={(v) => setUserType(v as PreviewUserType)}>
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guest">Visitor (guest)</SelectItem>
                <SelectItem value="logged">Logged-in user</SelectItem>
                <SelectItem value="vip">VIP user (no ads)</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border mx-1" />

            {/* Compare */}
            <Button
              size="sm"
              variant={compare ? "default" : "outline"}
              onClick={() => setCompare((v) => !v)}
            >
              <Columns className="h-4 w-4 mr-1" /> Compare
            </Button>
            <Button size="sm" variant="outline" onClick={reload} title="Reload preview">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Open live page
            </a>

            <div className="ml-auto flex items-center gap-2">
              {errors.length > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {errors.length} error
                  {errors.length > 1 ? "s" : ""}
                </Badge>
              ) : (
                <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Ready
                </Badge>
              )}
              {issues.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setShowIssues((v) => !v)}>
                  {showIssues ? "Hide" : "Show"} {issues.length} note
                  {issues.length > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>

          {/* Validation panel */}
          {showIssues && issues.length > 0 && (
            <div className="mt-2 rounded border bg-muted/30 p-2 max-h-[110px] overflow-auto space-y-1">
              {issues.map((i, idx) => (
                <div
                  key={idx}
                  className={
                    "text-xs flex items-start gap-2 " +
                    (i.level === "error"
                      ? "text-destructive"
                      : i.level === "warning"
                      ? "text-amber-600"
                      : "text-muted-foreground")
                  }
                >
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{i.message}</span>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Preview stage */}
        <div className="flex-1 min-h-0 overflow-auto bg-muted/30 p-4">
          <div
            className={
              "mx-auto flex " + (compare ? "gap-4 items-start justify-center" : "justify-center")
            }
          >
            {compare && (
              <FrameCard
                title="Current live site"
                width={d.w}
                height={d.h}
                src={liveUrl}
                iframeRef={iframeBRef}
              />
            )}
            <FrameCard
              title={compare ? "With preview ad" : `${d.label}`}
              width={d.w}
              height={d.h}
              src={previewUrl}
              iframeRef={iframeARef}
              highlight
            />
          </div>
        </div>

        {/* Footer actions */}
        {showActions && (
          <div className="border-t px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="text-xs text-muted-foreground">
              Preview only — nothing is saved until you publish.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                <RotateCcw className="h-4 w-4 mr-1" /> Cancel
              </Button>
              {onSaveDraft && (
                <Button variant="outline" onClick={onSaveDraft}>
                  Save Draft
                </Button>
              )}
              {onPublish && (
                <Button onClick={onPublish} disabled={errors.length > 0}>
                  {publishLabel}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FrameCard({
  title,
  width,
  height,
  src,
  iframeRef,
  highlight,
}: {
  title: string;
  width: number;
  height: number;
  src: string;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  highlight?: boolean;
}) {
  // Cap the visual scale so oversized devices still fit the modal.
  const maxW = Math.min(width, 1400);
  const scale = maxW / width;
  return (
    <div
      className={
        "rounded-lg overflow-hidden border bg-background shadow-lg " +
        (highlight ? "ring-2 ring-primary" : "")
      }
      style={{ width: maxW }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b text-xs">
        <span className="truncate">{title}</span>
        <span className="text-muted-foreground">
          {width}×{height}
          {scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}
        </span>
      </div>
      <div
        style={{
          width: maxW,
          height: height * scale,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          style={{
            width,
            height,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

export default AdPreviewDialog;
