import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Calendar, Edit2, LogOut,
  Camera, Save, Lock, Eye, EyeOff, Bookmark,
  Film, Tv, Image, FileText, Trash2, X,
} from "lucide-react";
import { useVipStatus } from "@/hooks/useVip";
import { VipBadge } from "@/components/VipBadge";
import { format } from "date-fns";
import { useNavigate, Link } from "react-router-dom";

type WatchLaterItem = { id: string; content_id: string; content_type: string; title?: string; poster_url?: string; };

export function ProfileHeader() {
  const { user, profile, signOut, updateProfile, updatePassword } = useAuth();
  const { isVip } = useVipStatus();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username || "");
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wlOpen, setWlOpen] = useState(false);
  const [wlItems, setWlItems] = useState<WatchLaterItem[]>([]);
  const [wlCount, setWlCount] = useState(0);
  const [wlLoading, setWlLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("watch_later").select("*", { count: "exact", head: true }).eq("user_id", user.id)
      .then(({ count }) => setWlCount(count || 0));
  }, [user]);

  const fetchWatchLater = async () => {
    if (!user) return;
    setWlLoading(true);
    const { data } = await supabase.from("watch_later").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const enriched: WatchLaterItem[] = [];
    for (const item of data || []) {
      let title = "Unknown", poster = "";
      if (item.content_type === "movie") { const { data: d } = await supabase.from("movies").select("title, poster_url").eq("id", item.content_id).single(); title = d?.title || title; poster = d?.poster_url || ""; }
      else if (item.content_type === "anime") { const { data: d } = await supabase.from("anime").select("title, poster_url").eq("id", item.content_id).single(); title = d?.title || title; poster = d?.poster_url || ""; }
      else if (item.content_type === "highlight") { const { data: d } = await supabase.from("highlights").select("title_en, thumbnail_url").eq("id", item.content_id).single(); title = d?.title_en || title; poster = d?.thumbnail_url || ""; }
      else if (item.content_type === "article") { const { data: d } = await supabase.from("articles").select("title, cover_url").eq("id", item.content_id).single(); title = d?.title || title; poster = d?.cover_url || ""; }
      enriched.push({ ...item, title, poster_url: poster });
    }
    setWlItems(enriched);
    setWlCount(enriched.length);
    setWlLoading(false);
  };

  const handleOpenWl = () => { setWlOpen(true); fetchWatchLater(); };

  const handleRemoveWl = async (itemId: string) => {
    const { error } = await supabase.from("watch_later").delete().eq("id", itemId);
    if (error) { toast.error("Failed to remove"); return; }
    setWlItems((prev) => prev.filter((i) => i.id !== itemId));
    setWlCount((c) => Math.max(0, c - 1));
    toast.success(t("toast.removedFromWL"));
  };

  const getContentLink = (item: WatchLaterItem) => {
    const map: Record<string, string> = { movie: "movies", anime: "anime", highlight: "highlights", article: "articles" };
    return `/${map[item.content_type] || "movies"}/${item.content_id}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "movie": return <Film className="h-3.5 w-3.5" />;
      case "anime": return <Tv className="h-3.5 w-3.5" />;
      case "background": return <Image className="h-3.5 w-3.5" />;
      case "article": return <FileText className="h-3.5 w-3.5" />;
      default: return <Film className="h-3.5 w-3.5" />;
    }
  };

  if (!user || !profile) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("File must be under 2MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Failed to upload avatar"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await updateProfile({ avatar_url: publicUrl });
    setUploading(false);
    if (error) toast.error("Failed to update avatar"); else toast.success(t("toast.avatarUpdated"));
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) { toast.error("Username cannot be empty"); return; }
    setSaving(true);
    const { error } = await updateProfile({ username: newUsername.trim() });
    setSaving(false);
    if (error) toast.error("Failed to update username");
    else { toast.success(t("toast.usernameUpdated")); setEditingUsername(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    const { error } = await updatePassword(newPassword);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(t("toast.passwordUpdated")); setChangingPassword(false); setNewPassword(""); setConfirmPassword(""); }
  };

  const handleLogout = async () => { await signOut(); navigate("/"); toast.success(t("toast.loggedOut")); };

  return (
    <>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border p-8 backdrop-blur-xl ${isVip ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card/40 to-yellow-500/10 shadow-lg shadow-amber-500/10" : "border-border/30 bg-card/40"}`}>
      <div className={`absolute inset-0 ${isVip ? "bg-gradient-to-br from-amber-500/5 via-transparent to-yellow-500/5" : "bg-gradient-to-br from-primary/5 via-transparent to-secondary/5"}`} />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative group">
          <div className={`h-28 w-28 overflow-hidden rounded-full border-2 shadow-lg ${isVip ? "border-amber-400/60 shadow-amber-500/20" : "border-primary/30"}`}>
            {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" /> : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10"><User className="h-12 w-12 text-primary" /></div>
            )}
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60 opacity-0 transition-opacity group-hover:opacity-100" disabled={uploading}>
            <Camera className="h-6 w-6 text-foreground" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            {editingUsername ? (
              <div className="flex items-center gap-2">
                <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="h-8 w-48 border-border/50 bg-background/50" />
                <Button size="sm" onClick={handleSaveUsername} disabled={saving} className="gradient-brand text-primary-foreground"><Save className="h-3 w-3" /></Button>
              </div>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold text-foreground">{profile.username || "User"}</h1>
                {isVip && <VipBadge size="md" />}
                <button onClick={() => { setEditingUsername(true); setNewUsername(profile.username || ""); }}><Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" /></button>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:gap-4">
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {t("profile.joined")} {format(new Date(profile.created_at), "MMM yyyy")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setChangingPassword(!changingPassword)} className="border-border/50">
            <Lock className="mr-1 h-3 w-3" /> {t("profile.changePassword")}
          </Button>
          <button onClick={handleOpenWl} className="relative rounded-lg p-2 transition-all duration-200 border border-border/30 bg-card/40 backdrop-blur-sm text-muted-foreground hover:bg-primary/15 hover:text-primary hover:shadow-md hover:shadow-primary/10">
            <Bookmark className="h-4 w-4" />
            {wlCount > 0 && (
              <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[9px] font-bold leading-none flex items-center justify-center rounded-full bg-primary text-primary-foreground border-0">
                {wlCount > 99 ? "99+" : wlCount}
              </Badge>
            )}
          </button>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-3 w-3" /> {t("nav.logout")}
          </Button>
        </div>
      </div>

      {changingPassword && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="relative mt-6 rounded-xl border border-border/30 bg-background/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t("admin.changePassword")}</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Input type={showPassword ? "text" : "password"} placeholder={t("admin.newPassword")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10 border-border/50 bg-background/50" minLength={6} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input type={showPassword ? "text" : "password"} placeholder={t("admin.confirmPw")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="flex-1 border-border/50 bg-background/50" />
            <Button onClick={handleChangePassword} disabled={saving} className="gradient-brand text-primary-foreground">{t("admin.update")}</Button>
          </div>
        </motion.div>
      )}
    </motion.div>

    <AnimatePresence>
      {wlOpen && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25 }}
          className="mt-4 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/20">
            <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" /> {t("profile.watchLater")}
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">{wlCount}</Badge>
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWlOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto space-y-2">
            {wlLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("profile.loading")}</p>
            ) : wlItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("profile.noItems")}</p>
            ) : (
              <AnimatePresence>
                {wlItems.map((item) => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="group flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 p-2.5 transition-all hover:bg-background/50 hover:border-primary/30">
                    <Link to={getContentLink(item)} className="flex flex-1 items-center gap-3 min-w-0">
                      <div className="h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-muted/50">
                        {item.poster_url ? <img src={item.poster_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" /> : (
                          <div className="flex h-full w-full items-center justify-center">{getTypeIcon(item.content_type)}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          {getTypeIcon(item.content_type)}
                          <span className="capitalize">{item.content_type}</span>
                        </div>
                      </div>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveWl(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
