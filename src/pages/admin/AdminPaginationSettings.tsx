import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const DEFAULT_CONFIG = {
  items_per_page: 25,
  show_page_numbers: true,
  show_prev_next: true,
  show_first_last: true,
  pagination_style: "default",
};

type PaginationConfig = typeof DEFAULT_CONFIG;

const VALID_PAGE_SIZES = [10, 20, 25, 50, 100];

const PAGINATION_STYLES = [
  { value: "default", label: "Default" },
  { value: "minimal", label: "Minimal" },
  { value: "compact", label: "Compact" },
];

export default function AdminPaginationSettings() {
  const [config, setConfig] = useState<PaginationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { t } = useLanguage();

  const loadConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "pagination_config")
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (err: any) {
      console.error("Failed to load pagination config:", err);
      toast.error("Failed to load pagination settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          {
            key: "pagination_config",
            value: JSON.stringify(config),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) throw error;

      toast.success("Pagination settings saved successfully!");
    } catch (err: any) {
      console.error("Failed to save pagination config:", err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setConfig(DEFAULT_CONFIG);
    try {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          {
            key: "pagination_config",
            value: JSON.stringify(DEFAULT_CONFIG),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) throw error;

      toast.success("Pagination settings reset to defaults!");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset settings");
    }
  };

  const updateField = <K extends keyof PaginationConfig>(key: K, value: PaginationConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display">Pagination Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure how content pagination behaves across the entire website.
        </p>
      </div>

      {/* Items Per Page */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            Items Per Page
          </CardTitle>
          <CardDescription>
            Controls how many content cards are displayed on each page. Applies to Movies, Series, Anime, Articles, Highlights, and all listing pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="items_per_page" className="text-foreground whitespace-nowrap">
              Items per page:
            </Label>
            <Select
              value={String(config.items_per_page)}
              onValueChange={(v) => updateField("items_per_page", parseInt(v, 10))}
            >
              <SelectTrigger id="items_per_page" className="w-32 border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Display Options</CardTitle>
          <CardDescription>
            Choose which pagination controls appear at the bottom of content lists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show Page Numbers</p>
              <p className="text-xs text-muted-foreground">
                Display numbered page buttons (1, 2, 3, ...)
              </p>
            </div>
            <Switch
              checked={config.show_page_numbers}
              onCheckedChange={(v) => updateField("show_page_numbers", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show Previous / Next</p>
              <p className="text-xs text-muted-foreground">
                Display Prev and Next navigation buttons
              </p>
            </div>
            <Switch
              checked={config.show_prev_next}
              onCheckedChange={(v) => updateField("show_prev_next", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Show First / Last</p>
              <p className="text-xs text-muted-foreground">
                Display First and Last quick-jump buttons when applicable
              </p>
            </div>
            <Switch
              checked={config.show_first_last}
              onCheckedChange={(v) => updateField("show_first_last", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pagination Style */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Pagination Style</CardTitle>
          <CardDescription>Select the visual style for the pagination component.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="pagination_style" className="text-foreground whitespace-nowrap">
              Style:
            </Label>
            <Select
              value={config.pagination_style}
              onValueChange={(v) => updateField("pagination_style", v)}
            >
              <SelectTrigger id="pagination_style" className="w-40 border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGINATION_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save / Reset Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="gradient-brand text-primary-foreground gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}