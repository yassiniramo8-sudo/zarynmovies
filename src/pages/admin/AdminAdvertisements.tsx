import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useAdvertisements,
  useAdGlobalSettings,
  useAdPlacementSettings,
  useAdAuditLog,
  upsertPlacementSetting,
  logAdAudit,
  Advertisement,
} from "@/hooks/useAdvertisements";
import { DEFAULT_TRIGGER, TriggerConfig, parseTriggerConfig } from "@/lib/adTrigger";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Megaphone,
  Copy,
  MousePointerClick,
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  Power,
  ShieldAlert,
} from "lucide-react";
import { AdPreviewDialog } from "@/components/admin/AdPreviewDialog";

// ============ Config ============
const AD_TYPES = [
  { value: "adsense", label: "Google AdSense (code)" },
  { value: "html", label: "HTML / JS embed" },
  { value: "banner", label: "Banner" },
  { value: "inline", label: "Inline / Native" },
  { value: "sidebar", label: "Sidebar" },
  { value: "footer", label: "Footer" },
  { value: "sticky_top", label: "Sticky Top" },
  { value: "sticky_bottom", label: "Sticky Bottom" },
  { value: "popup", label: "Pop-up" },
  { value: "interstitial", label: "Interstitial" },
  { value: "floating", label: "Floating" },
  { value: "affiliate", label: "Affiliate" },
];

const PLACEMENTS = [
  { value: "header", label: "Header" },
  { value: "footer", label: "Footer" },
  { value: "sidebar", label: "Sidebar" },
  { value: "sticky_top", label: "Sticky Top Bar" },
  { value: "sticky_bottom", label: "Sticky Bottom Bar" },
  { value: "home_top", label: "Home – Top" },
  { value: "home_middle", label: "Home – Middle" },
  { value: "home_bottom", label: "Home – Bottom" },
  { value: "movies_list", label: "Movies List" },
  { value: "series_list", label: "Series List" },
  { value: "anime_list", label: "Anime List" },
  { value: "news_list", label: "News List" },
  { value: "articles_list", label: "Articles List" },
  { value: "search_results", label: "Search Results" },
  { value: "category_page", label: "Category Page" },
  { value: "movie_detail_top", label: "Movie Detail – Top" },
  { value: "movie_detail_bottom", label: "Movie Detail – Bottom" },
  { value: "above_player", label: "Above Player" },
  { value: "below_player", label: "Below Player" },
  { value: "player_video", label: "Player – Pre-roll Video" },
  { value: "player_overlay", label: "Player – Corner Overlay" },
  { value: "player_pause", label: "Player – On Pause" },
  { value: "player_banner", label: "Player – Bottom Banner" },
  { value: "between_episodes", label: "Between Episodes" },
  { value: "inside_article", label: "Inside Article" },
  { value: "after_paragraph", label: "After Paragraph" },
  { value: "before_comments", label: "Before Comments" },
  { value: "related_movies", label: "Related / Recommendations" },
  { value: "profile", label: "Profile" },
  { value: "between_cards", label: "Between Content Cards" },
  { value: "inline", label: "Inline (generic)" },
  { value: "popup", label: "Pop-up overlay" },
];

const LANGUAGES = [
  { value: "all", label: "All Languages" },
  { value: "ar", label: "Arabic (RTL)" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
];

const USER_TYPES = [
  { value: "all", label: "Everyone" },
  { value: "guest", label: "Guests only" },
  { value: "logged", label: "Logged-in users" },
  { value: "vip", label: "VIP members" },
  { value: "free", label: "Free (non-VIP) users" },
];

const DEVICES = [
  { value: "all", label: "All Devices" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "desktop", label: "Desktop" },
];

interface AdForm {
  title: string;
  ad_type: string;
  placement: string;
  content_html: string;
  image_url: string;
  link_url: string;
  active: boolean;
  hide_for_vip: boolean;
  language: string;
  sort_order: number;
  priority: number;
  user_type: string;
  device_targeting: string[];
  start_at: string;
  end_at: string;
  max_impressions: string;
  max_clicks: string;
  ab_group: string;
  reason: string;
  trigger: TriggerConfig;
}

const emptyAd: AdForm = {
  title: "",
  ad_type: "adsense",
  placement: "home_top",
  content_html: "",
  image_url: "",
  link_url: "",
  active: true,
  hide_for_vip: true,
  language: "all",
  sort_order: 0,
  priority: 0,
  user_type: "all",
  device_targeting: ["all"],
  start_at: "",
  end_at: "",
  max_impressions: "",
  max_clicks: "",
  ab_group: "",
  reason: "",
  trigger: { ...DEFAULT_TRIGGER },
};

// ============ Timing & Triggers Panel ============
function TriggerConfigPanel({
  value,
  onChange,
}: {
  value: TriggerConfig;
  onChange: (t: TriggerConfig) => void;
}) {
  const v: TriggerConfig = { ...DEFAULT_TRIGGER, ...value };
  const set = <K extends keyof TriggerConfig>(k: K, val: TriggerConfig[K]) =>
    onChange({ ...v, [k]: val });

  return (
    <div className="rounded-lg border p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Timed / Triggered Advertisement</div>
          <div className="text-xs text-muted-foreground">
            Show this ad as an overlay when a trigger fires (delay, scroll, video, exit-intent…).
          </div>
        </div>
        <Switch
          checked={!!v.enabled}
          onCheckedChange={(x) => set("enabled", x)}
        />
      </div>

      {v.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Trigger</Label>
              <Select value={v.trigger} onValueChange={(x) => set("trigger", x as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delay">After delay</SelectItem>
                  <SelectItem value="scroll">On scroll %</SelectItem>
                  <SelectItem value="video-play">On video play</SelectItem>
                  <SelectItem value="video-pause">On video pause</SelectItem>
                  <SelectItem value="video-progress">On video progress %</SelectItem>
                  <SelectItem value="page-end">On page end</SelectItem>
                  <SelectItem value="exit-intent">Exit intent (desktop)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Display Mode</Label>
              <Select value={v.displayMode} onValueChange={(x) => set("displayMode", x as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center popup</SelectItem>
                  <SelectItem value="floating-card">Floating card</SelectItem>
                  <SelectItem value="bottom-popup">Bottom popup</SelectItem>
                  <SelectItem value="top-notification">Top notification</SelectItem>
                  <SelectItem value="slide-left">Slide-in left</SelectItem>
                  <SelectItem value="slide-right">Slide-in right</SelectItem>
                  <SelectItem value="fullscreen">Fullscreen interstitial</SelectItem>
                  <SelectItem value="player-overlay">Overlay on video player</SelectItem>
                  <SelectItem value="corner-floating">Small corner floating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {v.trigger === "delay" && (
              <div>
                <Label>Delay (seconds)</Label>
                <Input
                  type="number" min={0}
                  value={v.delaySeconds ?? 10}
                  onChange={(e) => set("delaySeconds", parseInt(e.target.value || "0"))}
                />
              </div>
            )}
            {v.trigger === "scroll" && (
              <div>
                <Label>Scroll % threshold</Label>
                <Input
                  type="number" min={1} max={100}
                  value={v.scrollPercent ?? 50}
                  onChange={(e) => set("scrollPercent", parseInt(e.target.value || "50"))}
                />
              </div>
            )}
            {v.trigger === "video-progress" && (
              <div>
                <Label>Video % watched</Label>
                <Input
                  type="number" min={1} max={100}
                  value={v.videoPercent ?? 20}
                  onChange={(e) => set("videoPercent", parseInt(e.target.value || "20"))}
                />
              </div>
            )}

            <div>
              <Label>Countdown before ad (seconds, 0 = none)</Label>
              <Input
                type="number" min={0}
                value={v.countdownSeconds ?? 0}
                onChange={(e) => set("countdownSeconds", parseInt(e.target.value || "0"))}
              />
            </div>

            <div>
              <Label>Auto-close after (seconds, 0 = never)</Label>
              <Input
                type="number" min={0}
                value={v.autoCloseSeconds ?? 0}
                onChange={(e) => set("autoCloseSeconds", parseInt(e.target.value || "0"))}
              />
            </div>

            <div>
              <Label>Lock close button for (seconds)</Label>
              <Input
                type="number" min={0}
                value={v.closeButtonLockSeconds ?? 0}
                onChange={(e) => set("closeButtonLockSeconds", parseInt(e.target.value || "0"))}
              />
            </div>

            <div>
              <Label>Frequency</Label>
              <Select value={v.frequency} onValueChange={(x) => set("frequency", x as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once-ever">Once per visitor (ever)</SelectItem>
                  <SelectItem value="once-per-session">Once per session</SelectItem>
                  <SelectItem value="hourly">Once every hour</SelectItem>
                  <SelectItem value="every-6h">Once every 6 hours</SelectItem>
                  <SelectItem value="every-12h">Once every 12 hours</SelectItem>
                  <SelectItem value="every-24h">Once every 24 hours</SelectItem>
                  <SelectItem value="every-x-pageviews">Every X pageviews</SelectItem>
                  <SelectItem value="every-x-minutes">Every X minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(v.frequency === "every-x-pageviews" || v.frequency === "every-x-minutes") && (
              <div>
                <Label>{v.frequency === "every-x-pageviews" ? "Every N pageviews" : "Every N minutes"}</Label>
                <Input
                  type="number" min={1}
                  value={v.frequencyValue ?? 5}
                  onChange={(e) => set("frequencyValue", parseInt(e.target.value || "1"))}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Wizard Dialog ============
function AdWizard({
  open,
  onClose,
  editing,
  onSaved,
  initialSortOrder,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  editing: Advertisement | null;
  onSaved: () => void;
  initialSortOrder: number;
  userId?: string;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdForm>(emptyAd);
  const [wizardPreviewOpen, setWizardPreviewOpen] = useState(false);

  // Reset when opened
  useMemo(() => {
    if (!open) return;
    setStep(1);
    if (editing) {
      setForm({
        title: editing.title,
        ad_type: editing.ad_type,
        placement: editing.placement,
        content_html: editing.content_html || "",
        image_url: editing.image_url || "",
        link_url: editing.link_url || "",
        active: editing.active,
        hide_for_vip: editing.hide_for_vip,
        language: editing.language || "all",
        sort_order: editing.sort_order,
        priority: editing.priority ?? 0,
        user_type: editing.user_type || "all",
        device_targeting: editing.device_targeting?.length
          ? editing.device_targeting
          : ["all"],
        start_at: editing.start_at ? editing.start_at.slice(0, 16) : "",
        end_at: editing.end_at ? editing.end_at.slice(0, 16) : "",
        max_impressions:
          editing.max_impressions != null ? String(editing.max_impressions) : "",
        max_clicks:
          editing.max_clicks != null ? String(editing.max_clicks) : "",
        ab_group: editing.ab_group || "",
        reason: "",
        trigger: { ...DEFAULT_TRIGGER, ...parseTriggerConfig((editing as any).trigger_config) },
      });
    } else {
      setForm({ ...emptyAd, sort_order: initialSortOrder });
    }
  }, [open, editing, initialSortOrder]);

  const setField = <K extends keyof AdForm>(k: K, v: AdForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleDevice = (d: string) => {
    setForm((f) => {
      let next = f.device_targeting.includes(d)
        ? f.device_targeting.filter((x) => x !== d)
        : [...f.device_targeting, d];
      if (d === "all") next = ["all"];
      else next = next.filter((x) => x !== "all");
      if (next.length === 0) next = ["all"];
      return { ...f, device_targeting: next };
    });
  };

  const canNext = () => {
    if (step === 1) return !!form.ad_type && !!form.title.trim();
    if (step === 2) return !!form.placement;
    if (step === 3)
      return !!(form.content_html.trim() || form.image_url.trim() || form.link_url.trim());
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      ad_type: form.ad_type,
      placement: form.placement,
      content_html: form.content_html || null,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      active: form.active,
      hide_for_vip: form.hide_for_vip,
      language: form.language,
      sort_order: form.sort_order,
      priority: form.priority,
      user_type: form.user_type,
      device_targeting: form.device_targeting,
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      max_impressions: form.max_impressions ? parseInt(form.max_impressions) : null,
      max_clicks: form.max_clicks ? parseInt(form.max_clicks) : null,
      ab_group: form.ab_group || null,
      trigger_config: form.trigger,
    };
    let err;
    let savedId: string | null = editing?.id ?? null;
    if (editing) {
      ({ error: err } = await supabase
        .from("advertisements")
        .update(payload)
        .eq("id", editing.id));
    } else {
      const { data, error } = await supabase
        .from("advertisements")
        .insert({ ...payload, created_by: userId ?? null })
        .select("id")
        .single();
      err = error;
      savedId = (data as any)?.id ?? null;
    }
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    // Attach admin-supplied reason as a separate audit entry — the trigger
    // has already recorded the structural change.
    if (form.reason.trim() && savedId) {
      await logAdAudit({
        ad_id: savedId,
        action: "reason",
        reason: form.reason.trim(),
      });
    }
    toast.success(editing ? "Ad updated" : "Ad created");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {editing ? "Edit Advertisement" : "Create Advertisement"}
            <Badge variant="outline" className="ml-auto">
              Step {step} / 5
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* STEP 1: type + title */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Ad Title (internal)</Label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Homepage AdSense banner"
              />
            </div>
            <div>
              <Label>Ad Type</Label>
              <Select
                value={form.ad_type}
                onValueChange={(v) => setField("ad_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP 2: placement + targeting */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Placement</Label>
              <Select
                value={form.placement}
                onValueChange={(v) => setField("placement", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PLACEMENTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setField("language", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience</Label>
                <Select
                  value={form.user_type}
                  onValueChange={(v) => setField("user_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_TYPES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Devices</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DEVICES.map((d) => (
                  <Badge
                    key={d.value}
                    variant={
                      form.device_targeting.includes(d.value)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer select-none"
                    onClick={() => toggleDevice(d.value)}
                  >
                    {d.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: content */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Ad Code (HTML / JS / AdSense snippet)</Label>
              <Textarea
                rows={8}
                className="font-mono text-xs"
                value={form.content_html}
                onChange={(e) => setField("content_html", e.target.value)}
                placeholder={`<script async src="https://pagead2.googlesyndication.com/..."></script>`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste an AdSense snippet, any HTML block, or an iframe.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Image URL (optional)</Label>
                <Input
                  value={form.image_url}
                  onChange={(e) => setField("image_url", e.target.value)}
                  placeholder="https://…/banner.jpg"
                />
              </div>
              <div>
                <Label>Click / Link URL (optional)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setField("link_url", e.target.value)}
                  placeholder="https://sponsor.com/…"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: schedule + frequency + priority */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setField("start_at", e.target.value)}
                />
              </div>
              <div>
                <Label>End (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setField("end_at", e.target.value)}
                />
              </div>
              <div>
                <Label>Max Impressions</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_impressions}
                  onChange={(e) => setField("max_impressions", e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <Label>Max Clicks</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_clicks}
                  onChange={(e) => setField("max_clicks", e.target.value)}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <Label>Priority (higher first)</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setField("priority", parseInt(e.target.value || "0"))
                  }
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setField("sort_order", parseInt(e.target.value || "0"))
                  }
                />
              </div>
              <div>
                <Label>A/B Group (optional)</Label>
                <Input
                  value={form.ab_group}
                  onChange={(e) => setField("ab_group", e.target.value)}
                  placeholder="e.g. variant-A"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Active</div>
                <div className="text-xs text-muted-foreground">
                  Turn on to make this ad eligible to display.
                </div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setField("active", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium">Hide for VIP members</div>
                <div className="text-xs text-muted-foreground">
                  Recommended for revenue ads.
                </div>
              </div>
              <Switch
                checked={form.hide_for_vip}
                onCheckedChange={(v) => setField("hide_for_vip", v)}
              />
            </div>

            <TriggerConfigPanel
              value={form.trigger}
              onChange={(t) => setField("trigger", t)}
            />
          </div>
        )}

        {/* STEP 5: preview */}
        {step === 5 && (
          <div className="space-y-4">
            <Card className="bg-muted/40">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Live Preview
                </CardTitle>
                <CardDescription>
                  Quick render — click <b>Open Full Live Preview</b> to see this ad inside the
                  real website at <code>{form.placement}</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.image_url && !form.content_html && (
                  <img
                    src={form.image_url}
                    alt={form.title}
                    className="w-full h-auto rounded-md"
                  />
                )}
                {form.content_html && (
                  <div
                    className="border rounded-md p-3 bg-background"
                    dangerouslySetInnerHTML={{ __html: form.content_html }}
                  />
                )}
                {!form.image_url && !form.content_html && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Nothing to preview yet — go back to Step 3.
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setWizardPreviewOpen(true)}
                  disabled={!form.image_url && !form.content_html}
                >
                  <Eye className="h-4 w-4 mr-2" /> Open Full Live Preview
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <span className="font-medium">{form.ad_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Placement:</span>{" "}
                <span className="font-medium">{form.placement}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Audience:</span>{" "}
                <span className="font-medium">{form.user_type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Devices:</span>{" "}
                <span className="font-medium">
                  {form.device_targeting.join(", ")}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Change reason (optional, added to audit log)</Label>
              <Textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setField("reason", e.target.value)}
                placeholder="e.g. Seasonal promotion, testing new copy, disabled after complaint…"
                rows={2}
              />
            </div>
          </div>
        )}


        <DialogFooter className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 5 ? (
            <Button
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={!canNext()}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Publishing…" : editing ? "Save Changes" : "Publish"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Full live preview from within the wizard */}
      <AdPreviewDialog
        open={wizardPreviewOpen}
        onClose={() => setWizardPreviewOpen(false)}
        ad={{
          title: form.title,
          ad_type: form.ad_type,
          placement: form.placement,
          content_html: form.content_html,
          image_url: form.image_url,
          link_url: form.link_url,
          language: form.language,
        }}
        onPublish={() => {
          setWizardPreviewOpen(false);
          handleSave();
        }}
        publishLabel={editing ? "Save Changes" : "Publish"}
      />
    </Dialog>
  );
}

// ============ Master Switches + Intensity ============
function MasterSwitches() {
  const { settings, loading } = useAdGlobalSettings();
  const { ads } = useAdvertisements();

  const update = async (patch: Partial<typeof settings>) => {
    if (!settings) return;
    const { error } = await supabase
      .from("ad_global_settings")
      .update(patch as any)
      .eq("id", settings.id);
    if (error) toast.error(error.message);
    else toast.success("Updated");
  };

  if (loading || !settings) return null;

  const intensity = (settings as any).ad_intensity ?? 50;
  const debugMode = !!(settings as any).debug_mode;

  const intensityLabel =
    intensity === 0
      ? "No advertisements"
      : intensity <= 10
      ? "Very Low"
      : intensity <= 20
      ? "Low"
      : intensity <= 30
      ? "Light"
      : intensity <= 40
      ? "Balanced"
      : intensity <= 50
      ? "Normal"
      : intensity <= 60
      ? "Medium"
      : intensity <= 70
      ? "High"
      : intensity <= 80
      ? "Very High"
      : intensity <= 90
      ? "Aggressive"
      : "Maximum";

  const activeAds = ads.filter((a) => a.active).length;
  const estimatedActive = Math.round((activeAds * intensity) / 100);

  const rows: Array<{
    key: keyof typeof settings;
    icon: React.ReactNode;
    title: string;
    desc: string;
    danger?: boolean;
  }> = [
    {
      key: "ads_enabled",
      icon: <Power className="h-4 w-4" />,
      title: "All Advertisements",
      desc: "Master switch — turn on to allow any ad to render across the site.",
    },
    {
      key: "google_ads_enabled",
      icon: <Activity className="h-4 w-4" />,
      title: "Google / AdSense",
      desc: "Enable or disable all Google AdSense-based ad units.",
    },
    {
      key: "affiliate_ads_enabled",
      icon: <MousePointerClick className="h-4 w-4" />,
      title: "Affiliate Ads",
      desc: "Enable or disable affiliate and sponsored links.",
    },
    {
      key: "debug_mode" as any,
      icon: <Eye className="h-4 w-4" />,
      title: "Debug Mode",
      desc: "Show placement badges + reasons on the live site. Only visible to viewers with debug on.",
    },
    {
      key: "emergency_hide",
      icon: <ShieldAlert className="h-4 w-4" />,
      title: "Emergency Hide All",
      desc: "Immediately hide every ad, everywhere. Use in incidents.",
      danger: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Intensity slider */}
      <Card className="bg-gradient-to-br from-primary/10 via-card/60 to-card/60 backdrop-blur border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Advertisement Intensity
          </CardTitle>
          <CardDescription>
            Controls how many advertisements are rendered site-wide. Updates
            everywhere instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-5xl font-bold text-primary tabular-nums">
                {intensity}%
              </div>
              <div className="text-sm text-muted-foreground">{intensityLabel}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">
                Estimated active placements
              </div>
              <div className="text-2xl font-semibold">
                {estimatedActive} <span className="text-muted-foreground text-base">/ {activeAds}</span>
              </div>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={intensity}
            onChange={(e) =>
              update({ ad_intensity: parseInt(e.target.value) } as any)
            }
            className="w-full accent-primary h-2 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </CardContent>
      </Card>

      {/* Switches grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <Card
            key={r.key as string}
            className={
              r.danger
                ? "border-destructive/40 bg-destructive/5"
                : "bg-card/60 backdrop-blur"
            }
          >
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div
                  className={`mt-1 rounded-md p-2 ${
                    r.danger
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {r.icon}
                </div>
                <div>
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-muted-foreground max-w-xs">
                    {r.desc}
                  </div>
                </div>
              </div>
              <Switch
                checked={!!(settings as any)[r.key]}
                onCheckedChange={(v) => update({ [r.key]: v } as any)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ Stats ============
function StatsDashboard({ ads }: { ads: Advertisement[] }) {
  const totals = useMemo(() => {
    const imp = ads.reduce((s, a) => s + (a.impressions_count || 0), 0);
    const clk = ads.reduce((s, a) => s + (a.clicks_count || 0), 0);
    const active = ads.filter((a) => a.active).length;
    const ctr = imp > 0 ? (clk / imp) * 100 : 0;
    return { imp, clk, active, ctr };
  }, [ads]);

  const top = useMemo(
    () =>
      [...ads]
        .sort((a, b) => (b.impressions_count || 0) - (a.impressions_count || 0))
        .slice(0, 5),
    [ads]
  );
  const worst = useMemo(
    () =>
      [...ads]
        .filter((a) => a.active)
        .sort((a, b) => (a.impressions_count || 0) - (b.impressions_count || 0))
        .slice(0, 5),
    [ads]
  );

  const stat = (label: string, value: string | number, icon: React.ReactNode) => (
    <Card className="bg-card/60 backdrop-blur">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {stat("Impressions", totals.imp.toLocaleString(), <Eye className="h-4 w-4" />)}
        {stat(
          "Clicks",
          totals.clk.toLocaleString(),
          <MousePointerClick className="h-4 w-4" />
        )}
        {stat("CTR", `${totals.ctr.toFixed(2)}%`, <Activity className="h-4 w-4" />)}
        {stat("Active Ads", totals.active, <Megaphone className="h-4 w-4" />)}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performers</CardTitle>
            <CardDescription>By impressions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {top.length === 0 && (
              <div className="text-sm text-muted-foreground">No data yet.</div>
            )}
            {top.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5"
              >
                <div className="truncate">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.placement}
                  </div>
                </div>
                <div className="text-right">
                  <div>{a.impressions_count.toLocaleString()} imp</div>
                  <div className="text-xs text-muted-foreground">
                    {a.clicks_count} clk
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Underperforming
            </CardTitle>
            <CardDescription>Active ads with fewest impressions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {worst.length === 0 && (
              <div className="text-sm text-muted-foreground">No data yet.</div>
            )}
            {worst.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5"
              >
                <div className="truncate">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.placement}
                  </div>
                </div>
                <div className="text-right">
                  <div>{a.impressions_count.toLocaleString()} imp</div>
                  <div className="text-xs text-muted-foreground">
                    {a.clicks_count} clk
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function AdminAdvertisements() {
  const { ads, loading, refetch } = useAdvertisements();
  const { user } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Advertisement | null>(null);
  const [previewAd, setPreviewAd] = useState<Advertisement | null>(null);
  const [search, setSearch] = useState("");
  const [placementFilter, setPlacementFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ads.filter((a) => {
      if (placementFilter !== "all" && a.placement !== placementFilter) return false;
      if (q && !a.title.toLowerCase().includes(q) && !a.ad_type.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [ads, search, placementFilter]);

  const openCreate = () => {
    setEditing(null);
    setWizardOpen(true);
  };
  const openEdit = (ad: Advertisement) => {
    setEditing(ad);
    setWizardOpen(true);
  };

  const toggleActive = async (ad: Advertisement) => {
    const { error } = await supabase
      .from("advertisements")
      .update({ active: !ad.active })
      .eq("id", ad.id);
    if (error) toast.error(error.message);
    else toast.success(!ad.active ? "Activated" : "Paused");
  };

  const duplicate = async (ad: Advertisement) => {
    const { id, created_at, updated_at, impressions_count, clicks_count, ...rest } =
      ad as any;
    const { error } = await supabase.from("advertisements").insert({
      ...rest,
      title: `${ad.title} (copy)`,
      active: false,
      created_by: user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else toast.success("Duplicated");
  };

  const remove = async (ad: Advertisement) => {
    if (!confirm(`Delete "${ad.title}"?`)) return;
    const { error } = await supabase.from("advertisements").delete().eq("id", ad.id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  };

  const bulkPause = async () => {
    const { error } = await supabase
      .from("advertisements")
      .update({ active: false })
      .eq("active", true);
    if (error) toast.error(error.message);
    else toast.success("All campaigns paused");
  };
  const bulkResume = async () => {
    const { error } = await supabase
      .from("advertisements")
      .update({ active: true })
      .eq("active", false);
    if (error) toast.error(error.message);
    else toast.success("All campaigns resumed");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Advertisement Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Live-synced across the site. Create, schedule, target, and track ads.
          </p>
        </div>
        <Button onClick={openCreate} size="lg" className="shrink-0">
          <Plus className="h-4 w-4 mr-1" /> New Ad
        </Button>
      </div>

      <Tabs defaultValue="ads" className="space-y-4">
        <TabsList className="grid grid-cols-5 md:w-auto md:inline-grid">
          <TabsTrigger value="ads">Advertisements</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="controls">Master Controls</TabsTrigger>
          <TabsTrigger value="placements">Placements</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* ADS TAB */}
        <TabsContent value="ads" className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or type…"
                className="pl-8"
              />
            </div>
            <Select value={placementFilter} onValueChange={setPlacementFilter}>
              <SelectTrigger className="md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All placements</SelectItem>
                {PLACEMENTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={bulkPause}>
              Pause All
            </Button>
            <Button variant="outline" onClick={bulkResume}>
              Resume All
            </Button>
          </div>

          <Card className="bg-card/60 backdrop-blur overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="text-right">Imp</TableHead>
                    <TableHead className="text-right">Clk</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-10 text-muted-foreground"
                      >
                        No advertisements found.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((ad) => {
                    const ctr =
                      ad.impressions_count > 0
                        ? (ad.clicks_count / ad.impressions_count) * 100
                        : 0;
                    return (
                      <TableRow key={ad.id}>
                        <TableCell className="font-medium max-w-[220px] truncate">
                          {ad.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ad.ad_type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{ad.placement}</TableCell>
                        <TableCell className="text-xs">{ad.user_type}</TableCell>
                        <TableCell className="text-right">
                          {ad.impressions_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {ad.clicks_count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {ctr.toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={ad.active}
                            onCheckedChange={() => toggleActive(ad)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setPreviewAd(ad)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(ad)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => duplicate(ad)}
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => remove(ad)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* STATS TAB */}
        <TabsContent value="stats">
          <StatsDashboard ads={ads} />
        </TabsContent>

        {/* MASTER CONTROLS */}
        <TabsContent value="controls">
          <MasterSwitches />
        </TabsContent>

        <TabsContent value="placements">
          <PlacementIntensityPanel />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogPanel />
        </TabsContent>
      </Tabs>


      {/* Wizard */}
      <AdWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        editing={editing}
        onSaved={refetch}
        initialSortOrder={ads.length}
        userId={user?.id}
      />

      {/* Full Live Preview from the list */}
      <AdPreviewDialog
        open={!!previewAd}
        onClose={() => setPreviewAd(null)}
        ad={
          previewAd
            ? {
                title: previewAd.title,
                ad_type: previewAd.ad_type,
                placement: previewAd.placement,
                content_html: previewAd.content_html || "",
                image_url: previewAd.image_url || "",
                link_url: previewAd.link_url || "",
                language: previewAd.language,
              }
            : { title: "", ad_type: "html", placement: "home_top" }
        }
        showActions={false}
      />

    </div>
  );
}

// ============ Placement Intensity Panel ============
function PlacementIntensityPanel() {
  const { placementSettings, loading } = useAdPlacementSettings();
  const { ads } = useAdvertisements();
  const { settings } = useAdGlobalSettings();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const globalIntensity = (settings as any)?.ad_intensity ?? 50;

  const placementUsage = useMemo(() => {
    const map: Record<string, number> = {};
    ads.forEach((a) => {
      map[a.placement] = (map[a.placement] || 0) + (a.active ? 1 : 0);
    });
    return map;
  }, [ads]);

  const save = async (
    placement: string,
    patch: { intensity?: number; enabled?: boolean }
  ) => {
    setPending((p) => ({ ...p, [placement]: true }));
    try {
      await upsertPlacementSetting(placement, patch);
      toast.success(`Updated ${placement}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setPending((p) => ({ ...p, [placement]: false }));
    }
  };

  const reset = async (placement: string) => {
    setPending((p) => ({ ...p, [placement]: true }));
    try {
      await supabase.from("ad_placement_settings" as any).delete().eq("placement", placement);
      await logAdAudit({
        ad_id: null,
        action: "placement_reset",
        reason: `reset ${placement} to global`,
      });
      toast.success(`Reset ${placement} to global`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset");
    } finally {
      setPending((p) => ({ ...p, [placement]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Per-placement intensity
        </CardTitle>
        <CardDescription>
          Override the global intensity ({globalIntensity}%) for any placement, or disable a
          placement entirely. Changes propagate live to every viewer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : (
          <div className="grid gap-3">
            {PLACEMENTS.map((p) => {
              const override = placementSettings[p.value];
              const activeIntensity = override ? override.intensity : globalIntensity;
              const enabled = override ? override.enabled : true;
              const activeAds = placementUsage[p.value] ?? 0;
              const isPending = !!pending[p.value];
              return (
                <div
                  key={p.value}
                  className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium text-sm">{p.label}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {p.value} · {activeAds} active ad{activeAds === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {override && (
                        <Badge variant="outline" className="text-xs">
                          override
                        </Badge>
                      )}
                      <Switch
                        checked={enabled}
                        disabled={isPending}
                        onCheckedChange={(v) => save(p.value, { enabled: v, intensity: activeIntensity })}
                      />
                      {override && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => reset(p.value)}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={activeIntensity}
                      disabled={isPending || !enabled}
                      onChange={(e) =>
                        save(p.value, { intensity: parseInt(e.target.value), enabled })
                      }
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {activeIntensity}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Audit Log Panel ============
function AuditLogPanel() {
  const { entries, loading } = useAdAuditLog(300);
  const [filter, setFilter] = useState<string>("all");

  const actions = useMemo(() => {
    const set = new Set(entries.map((e) => e.action));
    return ["all", ...Array.from(set)];
  }, [entries]);

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.action === filter)),
    [entries, filter],
  );

  const badgeVariant = (action: string) => {
    if (action === "delete") return "destructive" as const;
    if (action === "activate" || action === "create") return "default" as const;
    return "outline" as const;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Advertisement audit log
        </CardTitle>
        <CardDescription>
          Every create, edit, move, activate, deactivate, schedule and expiry, with the
          admin-supplied reason when provided.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}
          </span>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No audit entries yet.
          </p>
        ) : (
          <div className="max-h-[560px] overflow-y-auto rounded-md border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Reason / Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const changed = e.details?.changed
                    ? Object.keys(e.details.changed).join(", ")
                    : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("en-US")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(e.action)}>{e.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.ad_id ? e.ad_id.slice(0, 8) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.reason ? (
                          <span>{e.reason}</span>
                        ) : changed ? (
                          <span className="text-muted-foreground">changed: {changed}</span>
                        ) : e.details?.title ? (
                          <span className="text-muted-foreground">
                            {e.details.title}
                            {e.details.placement ? ` · ${e.details.placement}` : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

