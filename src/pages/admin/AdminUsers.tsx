import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserAdSettings } from "@/hooks/useUserAdSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Ban, Loader2, ShieldAlert, Clock, Plus, Megaphone, ShieldOff } from "lucide-react";
import { formatBanRemaining } from "@/hooks/useUserBan";

interface UserProfile { id: string; username: string | null; avatar_url: string | null; created_at: string; }
interface UserBan { id: string; user_id: string; ban_type: string; reason: string | null; expires_at: string | null; }

export default function AdminUsers() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bans, setBans] = useState<UserBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedBan, setSelectedBan] = useState<UserBan | null>(null);
  const [banType, setBanType] = useState("temporary");
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("30");
  const [banUnit, setBanUnit] = useState<"minutes" | "hours" | "days">("minutes");
  const [extendDuration, setExtendDuration] = useState("30");
  const [extendUnit, setExtendUnit] = useState<"minutes" | "hours" | "days">("minutes");
  const { settings: adSettings, updateSetting } = useUserAdSettings();

  const fetchData = async () => {
    const [usersRes, bansRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_bans").select("*"),
    ]);
    setUsers(usersRes.data || []); setBans(bansRes.data || []); setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { const interval = setInterval(() => { setBans((prev) => [...prev]); }, 60000); return () => clearInterval(interval); }, []);

  const getActiveBan = (userId: string) => bans.find((b) => { if (b.user_id !== userId) return false; if (b.ban_type === "permanent") return true; if (b.expires_at && new Date(b.expires_at) > new Date()) return true; return false; });

  const openBanDialog = (u: UserProfile) => { setSelectedUser(u); setBanType("temporary"); setBanReason(""); setBanDuration("30"); setBanUnit("minutes"); setBanDialogOpen(true); };

  const durationToMs = (value: string, unit: "minutes" | "hours" | "days") => { const num = parseInt(value) || 0; if (unit === "minutes") return num * 60000; if (unit === "hours") return num * 3600000; return num * 86400000; };

  const handleBan = async () => {
    if (!selectedUser) return;
    const expiresAt = banType === "temporary" ? new Date(Date.now() + durationToMs(banDuration, banUnit)).toISOString() : null;
    const { error } = await supabase.from("user_bans").insert({ user_id: selectedUser.id, ban_type: banType, reason: banReason || null, expires_at: expiresAt, banned_by: user?.id });
    if (error) toast.error(error.message); else { toast.success("User banned"); setBanDialogOpen(false); fetchData(); }
  };

  const handleExtend = async () => {
    if (!selectedBan) return;
    const currentExpiry = selectedBan.expires_at ? new Date(selectedBan.expires_at) : new Date();
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(base.getTime() + durationToMs(extendDuration, extendUnit)).toISOString();
    const { error } = await supabase.from("user_bans").update({ expires_at: newExpiry }).eq("id", selectedBan.id);
    if (error) toast.error(error.message); else { toast.success("Ban extended"); setExtendDialogOpen(false); fetchData(); }
  };

  const handleUnban = async (userId: string) => {
    const { error } = await supabase.from("user_bans").delete().eq("user_id", userId);
    if (error) toast.error(error.message); else { toast.success("User unbanned"); fetchData(); }
  };

  const openExtendDialog = (ban: UserBan) => { setSelectedBan(ban); setExtendDuration("30"); setExtendUnit("minutes"); setExtendDialogOpen(true); };

  const getAdSetting = (userId: string) => adSettings.find(s => s.user_id === userId) || { ads_enabled: true, adblock_enforcement: true, user_id: userId };

  const handleAdToggle = async (userId: string, field: "ads_enabled" | "adblock_enforcement", value: boolean) => {
    await updateSetting(userId, field, value);
    toast.success(field === "ads_enabled" ? (value ? "Ads enabled" : "Ads disabled") : (value ? "Anti-AdBlock enforced" : "Anti-AdBlock bypassed"));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">{t("admin.users")}</h1>
          <p className="text-muted-foreground mt-1">{users.length} {t("admin.registeredUsers")}</p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-muted-foreground">{t("admin.avatar")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("auth.username")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("profile.joined")}</TableHead>
                  <TableHead className="text-muted-foreground">{t("admin.status")}</TableHead>
                  <TableHead className="text-muted-foreground text-center">
                    <Tooltip><TooltipTrigger asChild><span className="flex items-center gap-1 justify-center"><Megaphone className="h-3.5 w-3.5" /> Ads</span></TooltipTrigger><TooltipContent>Show ads for this user</TooltipContent></Tooltip>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-center">
                    <Tooltip><TooltipTrigger asChild><span className="flex items-center gap-1 justify-center"><ShieldOff className="h-3.5 w-3.5" /> AdBlock</span></TooltipTrigger><TooltipContent>Enforce Anti-AdBlock for this user</TooltipContent></Tooltip>
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const activeBan = getActiveBan(u.id);
                  const adSetting = getAdSetting(u.id);
                  const isSelf = u.id === user?.id;
                  return (
                    <TableRow key={u.id} className="border-border/50">
                      <TableCell>{u.avatar_url ? <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="h-8 w-8 rounded-full bg-muted" />}</TableCell>
                      <TableCell className="font-medium text-foreground">{u.username || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {activeBan ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center gap-1.5">
                                <Badge variant="destructive" className="text-xs">{t("admin.banned")}</Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{formatBanRemaining(activeBan.expires_at, activeBan.ban_type)}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium">{t("admin.reason")}: {activeBan.reason || "No reason provided"}</p>
                              {activeBan.expires_at && <p className="text-xs text-muted-foreground mt-1">Expires: {new Date(activeBan.expires_at).toLocaleString()}</p>}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">{t("admin.active")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {!isSelf && (
                          <Switch
                            checked={adSetting.ads_enabled}
                            onCheckedChange={(v) => handleAdToggle(u.id, "ads_enabled", v)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {!isSelf && (
                          <Switch
                            checked={adSetting.adblock_enforcement}
                            onCheckedChange={(v) => handleAdToggle(u.id, "adblock_enforcement", v)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          activeBan ? (
                            <div className="flex items-center justify-end gap-1">
                              {activeBan.ban_type === "temporary" && <Button variant="ghost" size="sm" onClick={() => openExtendDialog(activeBan)}><Plus className="mr-1 h-4 w-4" /> {t("admin.extend")}</Button>}
                              <Button variant="ghost" size="sm" onClick={() => handleUnban(u.id)}><ShieldAlert className="mr-1 h-4 w-4" /> {t("admin.unban")}</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => openBanDialog(u)} className="text-destructive"><Ban className="mr-1 h-4 w-4" /> {t("admin.ban")}</Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
            <DialogHeader><DialogTitle>{t("admin.ban")} {selectedUser?.username || "User"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-foreground">{t("admin.banType")}</Label>
                <Select value={banType} onValueChange={setBanType}>
                  <SelectTrigger className="border-border/50 bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="temporary">{t("admin.temporary")}</SelectItem>
                    <SelectItem value="permanent">{t("admin.permanent")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {banType === "temporary" && (
                <div className="space-y-1.5">
                  <Label className="text-foreground">{t("admin.duration")}</Label>
                  <div className="flex gap-2">
                    <Input type="number" min="1" value={banDuration} onChange={(e) => setBanDuration(e.target.value)} className="border-border/50 bg-background/50 w-24" />
                    <Select value={banUnit} onValueChange={(v) => setBanUnit(v as any)}>
                      <SelectTrigger className="border-border/50 bg-background/50 flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">{t("admin.minutes")}</SelectItem>
                        <SelectItem value="hours">{t("admin.hours")}</SelectItem>
                        <SelectItem value="days">{t("admin.days")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-foreground">{t("admin.reason")}</Label>
                <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} className="border-border/50 bg-background/50" placeholder="Optional reason shown to the user" />
              </div>
              <Button onClick={handleBan} className="w-full" variant="destructive">{t("admin.confirmBan")}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
          <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
            <DialogHeader><DialogTitle>{t("admin.extendBan")}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Current expiry: {selectedBan?.expires_at ? new Date(selectedBan.expires_at).toLocaleString() : "N/A"}</p>
              <div className="space-y-1.5">
                <Label className="text-foreground">{t("admin.extend")}</Label>
                <div className="flex gap-2">
                  <Input type="number" min="1" value={extendDuration} onChange={(e) => setExtendDuration(e.target.value)} className="border-border/50 bg-background/50 w-24" />
                  <Select value={extendUnit} onValueChange={(v) => setExtendUnit(v as any)}>
                    <SelectTrigger className="border-border/50 bg-background/50 flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">{t("admin.minutes")}</SelectItem>
                      <SelectItem value="hours">{t("admin.hours")}</SelectItem>
                      <SelectItem value="days">{t("admin.days")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleExtend} className="w-full" variant="destructive">{t("admin.extendBan")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
