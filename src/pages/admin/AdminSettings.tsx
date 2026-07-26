import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSiteLogo } from "@/hooks/useSiteLogo";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, ShieldAlert, Image, Upload, RotateCcw, Download, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { exportSiteBackup } from "@/utils/siteBackup";

export default function AdminSettings() {
  const { updatePassword } = useAuth();
  const { t } = useLanguage();
  const { antiAdblockEnabled, toggleAntiAdblock, loading: settingsLoading } = useSiteSettings();
  const { logoUrl, updateLogo, restoreDefault, DEFAULT_LOGO } = useSiteLogo();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupDone, setBackupDone] = useState(false);

  const handleBackup = async () => {
    setBackupRunning(true);
    setBackupDone(false);
    setBackupProgress(0);
    setBackupMessage("Starting backup...");
    try {
      await exportSiteBackup((msg, pct) => {
        setBackupMessage(msg);
        setBackupProgress(pct);
      });
      setBackupDone(true);
      toast.success("Site backup downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Backup failed");
    } finally {
      setBackupRunning(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/site-logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("content").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("content").getPublicUrl(path);
      await updateLogo(urlData.publicUrl);
      setLogoPreview(null);
      toast.success("Logo updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRestoreDefault = async () => {
    await restoreDefault();
    setLogoPreview(null);
    toast.success("Logo restored to default");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    const { error } = await updatePassword(newPassword);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t("toast.passwordUpdated")); setNewPassword(""); setConfirmPassword(""); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display">{t("admin.settings")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.settings")}</p>
      </div>

      {/* Logo Management */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Image className="h-5 w-5 text-primary" /> Logo Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground font-medium">Current Logo</p>
              <div className="h-24 w-24 rounded-full border-2 border-border/50 bg-muted/30 flex items-center justify-center overflow-hidden">
                <img src={logoPreview || logoUrl} alt="Site logo" className="h-full w-full object-contain rounded-full" />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
              <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose New Logo
              </Button>
              {logoPreview && (
                <div className="flex gap-2">
                  <Button className="gradient-brand text-primary-foreground gap-2" disabled={uploadingLogo} onClick={handleLogoUpload}>
                    {uploadingLogo ? "Uploading..." : "Save Logo"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setLogoPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>Cancel</Button>
                </div>
              )}
              {logoUrl !== DEFAULT_LOGO && !logoPreview && (
                <Button variant="outline" className="gap-2" onClick={handleRestoreDefault}>
                  <RotateCcw className="h-4 w-4" /> Restore Default Logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Upload a circular PNG image. It will be used in the navbar, favicon, and social media meta tags.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldAlert className="h-5 w-5 text-primary" /> Anti-AdBlock System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When enabled, users with ad blockers will be blocked from accessing content, video playback, comments, and likes. Admins are always exempt.
          </p>
          <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Anti-AdBlock</p>
              <p className="text-xs text-muted-foreground">Block non-admin users who use ad blockers</p>
            </div>
            <Switch
              checked={antiAdblockEnabled}
              disabled={settingsLoading}
              onCheckedChange={async (checked) => {
                await toggleAntiAdblock(checked);
                toast.success(checked ? "Anti-AdBlock enabled" : "Anti-AdBlock disabled");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Lock className="h-5 w-5 text-primary" /> {t("admin.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground">{t("admin.newPassword")}</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="pr-10 border-border/50 bg-background/50" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t("admin.confirmPw")}</Label>
              <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="border-border/50 bg-background/50" />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={saving} className="gradient-brand text-primary-foreground">{t("admin.updatePassword")}</Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Download className="h-5 w-5 text-primary" /> Download Site Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export all database content, media files, and settings as a single ZIP file. The backup includes all tables as JSON and uploaded media from storage.
          </p>
          {backupRunning && (
            <div className="space-y-2">
              <Progress value={backupProgress} className="h-2" />
              <p className="text-xs text-muted-foreground animate-pulse">{backupMessage}</p>
            </div>
          )}
          {backupDone && !backupRunning && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="h-4 w-4" /> Backup downloaded successfully!
            </div>
          )}
          <Button onClick={handleBackup} disabled={backupRunning} className="gradient-brand text-primary-foreground gap-2">
            <Download className="h-4 w-4" />
            {backupRunning ? "Exporting..." : "Download Site Backup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
