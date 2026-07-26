import { useState, useEffect, useRef } from "react";
import { useThemeSettings, applyThemeToDOM, type ThemeSettings } from "@/hooks/useThemeSettings";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette, Upload, RotateCcw, Save, Loader2, Trash2, ImageIcon, Type, Navigation, MousePointer, Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const gradientPresets = [
  { name: "Ocean Blue", value: "linear-gradient(135deg, hsl(220 45% 6%) 0%, hsl(210 50% 12%) 30%, hsl(230 40% 8%) 60%, hsl(200 45% 10%) 100%)" },
  { name: "Deep Purple", value: "linear-gradient(135deg, hsl(270 40% 8%) 0%, hsl(260 50% 14%) 30%, hsl(280 35% 10%) 60%, hsl(250 40% 12%) 100%)" },
  { name: "Emerald Night", value: "linear-gradient(135deg, hsl(160 40% 5%) 0%, hsl(170 50% 10%) 30%, hsl(150 35% 7%) 60%, hsl(180 40% 8%) 100%)" },
  { name: "Crimson Dark", value: "linear-gradient(135deg, hsl(0 35% 7%) 0%, hsl(350 45% 12%) 30%, hsl(10 30% 8%) 60%, hsl(340 40% 10%) 100%)" },
  { name: "Midnight", value: "linear-gradient(135deg, hsl(240 20% 5%) 0%, hsl(230 30% 10%) 30%, hsl(250 25% 7%) 60%, hsl(220 30% 9%) 100%)" },
  { name: "Sunset", value: "linear-gradient(135deg, hsl(20 40% 6%) 0%, hsl(30 50% 10%) 30%, hsl(10 35% 8%) 60%, hsl(40 45% 9%) 100%)" },
];

const vipGradientPresets = [
  { name: "Royal Gold", value: "linear-gradient(135deg, hsl(43 80% 8%) 0%, hsl(38 70% 14%) 25%, hsl(45 60% 10%) 50%, hsl(30 65% 12%) 75%, hsl(50 55% 8%) 100%)" },
  { name: "Golden Dusk", value: "linear-gradient(135deg, hsl(35 75% 6%) 0%, hsl(45 85% 12%) 30%, hsl(40 65% 9%) 60%, hsl(50 70% 11%) 100%)" },
  { name: "Amber Luxe", value: "linear-gradient(135deg, hsl(30 60% 7%) 0%, hsl(40 80% 15%) 25%, hsl(25 50% 10%) 50%, hsl(45 75% 13%) 75%, hsl(35 65% 9%) 100%)" },
  { name: "Bronze Night", value: "linear-gradient(135deg, hsl(25 50% 6%) 0%, hsl(35 60% 11%) 30%, hsl(20 45% 8%) 60%, hsl(30 55% 10%) 100%)" },
  { name: "Golden Crown", value: "linear-gradient(135deg, hsl(48 90% 8%) 0%, hsl(42 80% 16%) 30%, hsl(38 70% 10%) 60%, hsl(52 85% 12%) 100%)" },
  { name: "Warm Gold", value: "linear-gradient(135deg, hsl(40 70% 5%) 0%, hsl(35 80% 13%) 25%, hsl(45 65% 8%) 50%, hsl(30 75% 11%) 75%, hsl(50 60% 7%) 100%)" },
];

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description?: string;
}

function ColorField({ label, value, onChange, description }: ColorFieldProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/30 p-3">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {value && (
        <button onClick={() => onChange("")} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function AdminAppearance() {
  const { theme: savedTheme, saveTheme, loading } = useThemeSettings();
  const { isSuperAdmin } = useRoles();
  const [draft, setDraft] = useState<ThemeSettings>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) setDraft(savedTheme);
  }, [savedTheme, loading]);

  // Live preview: apply draft to DOM as user changes
  useEffect(() => {
    applyThemeToDOM(draft);
  }, [draft]);

  const updateDraft = (key: keyof ThemeSettings, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `theme/background-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("content").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("content").getPublicUrl(path);
    setDraft((prev) => ({ ...prev, backgroundImage: urlData.publicUrl, backgroundGradient: undefined }));
    setUploading(false);
    toast.success("Background uploaded");
  };

  const handleSave = async () => {
    setSaving(true);
    await saveTheme(draft);
    setSaving(false);
    toast.success("Theme saved and applied");
  };

  const handleReset = () => {
    setDraft({});
    applyThemeToDOM({});
    toast.info("Preview reset to defaults");
  };

  const handleSaveReset = async () => {
    setSaving(true);
    await saveTheme({});
    applyThemeToDOM({});
    setSaving(false);
    toast.success("Theme restored to defaults");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isSuperAdmin) return <p className="text-muted-foreground py-8 text-center">Only Super Admins can modify appearance settings.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">Website Appearance</h1>
          <p className="text-muted-foreground mt-1">Customize the visual style of your website</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2 border-border/50">
            <RotateCcw className="h-4 w-4" /> Preview Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 gradient-brand text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Theme
          </Button>
        </div>
      </div>

      {/* Live Preview Card */}
      <Card className="border-primary/30 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-foreground text-sm">
            <Palette className="h-4 w-4 text-primary" /> Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/30 overflow-hidden" style={{ minHeight: 180 }}>
            {/* Mini nav preview */}
            <div
              className="flex items-center gap-4 px-4 py-2.5"
              style={{
                backgroundColor: draft.navBg || "hsl(var(--card))",
                color: draft.navText || "hsl(var(--foreground))",
              }}
            >
              <span className="text-sm font-bold" style={{ color: draft.headingColor || undefined }}>Zaryn Movies</span>
              <span className="text-xs opacity-70">Movies</span>
              <span className="text-xs opacity-70">Anime</span>
              <span className="text-xs opacity-70">Series</span>
              <span className="ml-auto">
                <span
                  className="text-xs px-3 py-1 rounded-md"
                  style={{
                    backgroundColor: draft.buttonBg || "hsl(var(--primary))",
                    color: draft.buttonText || "hsl(var(--primary-foreground))",
                  }}
                >
                  Sign In
                </span>
              </span>
            </div>
            {/* Mini content preview */}
            <div
              className="p-4"
              style={{
                backgroundImage: draft.backgroundImage ? `url(${draft.backgroundImage})` : undefined,
                background: !draft.backgroundImage && draft.backgroundGradient ? draft.backgroundGradient : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                minHeight: 120,
              }}
            >
              <p className="text-lg font-bold mb-1" style={{ color: draft.headingColor || "hsl(var(--foreground))" }}>
                Featured Title
              </p>
              <p className="text-xs opacity-60 mb-3" style={{ color: draft.navText || undefined }}>
                A sample description text preview
              </p>
              <span
                className="text-xs px-3 py-1.5 rounded-md inline-block"
                style={{
                  backgroundColor: draft.buttonBg || "hsl(var(--primary))",
                  color: draft.buttonText || "hsl(var(--primary-foreground))",
                }}
              >
                Watch Now
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Background */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ImageIcon className="h-5 w-5 text-primary" /> Background
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2 border-border/50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Image
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadBg} />
            {draft.backgroundImage && (
              <Button variant="outline" onClick={() => updateDraft("backgroundImage", "")} className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Remove Image
              </Button>
            )}
          </div>

          {draft.backgroundImage && (
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <img src={draft.backgroundImage} alt="Background preview" className="h-32 w-full object-cover" />
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Or choose a gradient preset:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gradientPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setDraft((prev) => ({ ...prev, backgroundGradient: preset.value, backgroundImage: undefined }))}
                  className={`group rounded-xl border-2 p-1 transition-all duration-200 ${draft.backgroundGradient === preset.value && !draft.backgroundImage ? "border-primary shadow-lg shadow-primary/20" : "border-border/30 hover:border-primary/50"}`}
                >
                  <div className="h-16 rounded-lg" style={{ background: preset.value }} />
                  <p className="text-xs font-medium text-foreground mt-1.5 mb-1">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Colors */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Navigation className="h-5 w-5 text-primary" /> Navigation Colors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ColorField label="Navigation Background" value={draft.navBg || ""} onChange={(v) => updateDraft("navBg", v)} description="Background color of the top navigation bar" />
          <ColorField label="Navigation Text" value={draft.navText || ""} onChange={(v) => updateDraft("navText", v)} description="Color of menu items in the navigation" />
        </CardContent>
      </Card>

      {/* Typography Colors */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Type className="h-5 w-5 text-primary" /> Typography & Brand Colors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ColorField label="Headings Color" value={draft.headingColor || ""} onChange={(v) => updateDraft("headingColor", v)} description="Color of section titles and headings" />
          <ColorField label="Primary Brand Color" value={draft.primaryColor || ""} onChange={(v) => updateDraft("primaryColor", v)} description="Main accent color used across the site" />
          <ColorField label="Secondary Brand Color" value={draft.secondaryColor || ""} onChange={(v) => updateDraft("secondaryColor", v)} description="Secondary accent for gradients and highlights" />
        </CardContent>
      </Card>

      {/* Button Colors */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <MousePointer className="h-5 w-5 text-primary" /> Button Colors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ColorField label="Button Background" value={draft.buttonBg || ""} onChange={(v) => updateDraft("buttonBg", v)} description="Background color of primary action buttons" />
          <ColorField label="Button Text" value={draft.buttonText || ""} onChange={(v) => updateDraft("buttonText", v)} description="Text color inside buttons" />
        </CardContent>
      </Card>

      {/* VIP Golden Background */}
      <Card className="border-amber-500/30 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Crown className="h-5 w-5 text-amber-500" /> VIP Golden Background
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/30 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Enable VIP Background</p>
              <p className="text-xs text-muted-foreground">VIP users see a luxurious golden gradient instead of the default background</p>
            </div>
            <Switch
              checked={draft.vipBackgroundEnabled !== false}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, vipBackgroundEnabled: checked }))}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">Choose VIP gradient:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {vipGradientPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setDraft((prev) => ({ ...prev, vipBackgroundGradient: preset.value }))}
                  className={`group rounded-xl border-2 p-1 transition-all duration-200 ${draft.vipBackgroundGradient === preset.value ? "border-amber-500 shadow-lg shadow-amber-500/20" : "border-border/30 hover:border-amber-500/50"}`}
                >
                  <div className="h-16 rounded-lg" style={{ background: preset.value }} />
                  <p className="text-xs font-medium text-foreground mt-1.5 mb-1">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* VIP Preview */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">VIP Preview:</p>
            <div
              className="rounded-xl border border-amber-500/30 p-4 overflow-hidden"
              style={{
                background: draft.vipBackgroundGradient || "linear-gradient(135deg, hsl(43 80% 8%) 0%, hsl(38 70% 14%) 25%, hsl(45 60% 10%) 50%, hsl(30 65% 12%) 75%, hsl(50 55% 8%) 100%)",
                minHeight: 100,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-100">VIP User</p>
                  <p className="text-xs text-amber-300/70">Premium Member</p>
                </div>
              </div>
              <p className="text-xs text-amber-200/60">This is how VIP users will see the website background</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restore Defaults */}
      <Card className="border-destructive/20 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Restore Default Theme</p>
              <p className="text-xs text-muted-foreground">Remove all customizations and revert to the original design</p>
            </div>
            <Button variant="outline" onClick={handleSaveReset} disabled={saving} className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10">
              <RotateCcw className="h-4 w-4" /> Restore Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
