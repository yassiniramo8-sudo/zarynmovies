import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VipBadge } from "@/components/VipBadge";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import {
  Loader2, Crown, Plus, Clock, Ban, CalendarPlus, Search,
  UserPlus, Trash2, Filter, ArrowUpDown,
} from "lucide-react";

interface Sub {
  id: string; user_id: string; plan_id: string; starts_at: string; expires_at: string;
  payment_method: string | null; created_at: string;
  plan?: { name: string; price: number; currency: string; duration_days: number } | null;
  profile?: { username: string | null; avatar_url: string | null } | null;
}
interface Plan { id: string; name: string; duration_days: number; price: number; currency: string; }
interface Profile { id: string; username: string | null; avatar_url: string | null; }

export default function AdminVipMembers() {
  const { user: adminUser } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [sortBy, setSortBy] = useState<"expires" | "username">("expires");

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [assignLifetime, setAssignLifetime] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Extend dialog
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendSub, setExtendSub] = useState<Sub | null>(null);
  const [extendDays, setExtendDays] = useState("30");

  const fetchData = async () => {
    const [subsRes, plansRes, profilesRes] = await Promise.all([
      supabase.from("user_subscriptions").select("*, plan:subscription_plans(name, price, currency, duration_days)").order("expires_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, name, duration_days, price, currency").order("sort_order"),
      supabase.from("profiles").select("id, username, avatar_url"),
    ]);
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
    const subsWithProfile = (subsRes.data || []).map((s: any) => ({
      ...s,
      profile: profileMap.get(s.user_id) || null,
    }));
    setSubs(subsWithProfile as Sub[]);
    setPlans(plansRes.data || []);
    setAllProfiles(profilesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getExpiry = (planId: string, startDate: string, lifetime: boolean) => {
    if (lifetime) return "2099-12-31T23:59:59Z";
    const plan = plans.find(p => p.id === planId);
    const days = plan?.duration_days || 30;
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const handleAssign = async () => {
    if (!assignUserId || !assignPlanId) { toast.error("Select a user and plan"); return; }
    setSubmitting(true);
    const expires_at = getExpiry(assignPlanId, assignStartDate, assignLifetime);
    const { error } = await supabase.from("user_subscriptions").insert({
      user_id: assignUserId,
      plan_id: assignPlanId,
      starts_at: new Date(assignStartDate).toISOString(),
      expires_at,
      payment_method: "admin_assigned",
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    // Disable ads for VIP user
    const { data: existing } = await supabase.from("user_ad_settings").select("id").eq("user_id", assignUserId).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("user_ad_settings").update({ ads_enabled: false, adblock_enforcement: false }).eq("user_id", assignUserId);
    } else {
      await supabase.from("user_ad_settings").insert({ user_id: assignUserId, ads_enabled: false, adblock_enforcement: false });
    }

    // Send notification
    const plan = plans.find(p => p.id === assignPlanId);
    await supabase.from("notifications").insert({
      user_id: assignUserId,
      title: "🎉 VIP Activated!",
      message: `You've been granted ${plan?.name || "VIP"} membership${assignLifetime ? " (Lifetime)" : ""}. Enjoy all VIP benefits!`,
      link: "/profile",
    });

    toast.success("VIP assigned successfully!");
    setSubmitting(false);
    setAssignOpen(false);
    fetchData();
  };

  const handleExtend = async () => {
    if (!extendSub) return;
    setSubmitting(true);
    const currentExpiry = new Date(extendSub.expires_at);
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    base.setDate(base.getDate() + parseInt(extendDays));
    const { error } = await supabase.from("user_subscriptions").update({ expires_at: base.toISOString() }).eq("id", extendSub.id);
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    await supabase.from("notifications").insert({
      user_id: extendSub.user_id,
      title: "⏱️ VIP Extended!",
      message: `Your VIP membership has been extended by ${extendDays} days.`,
      link: "/profile",
    });

    toast.success("VIP extended!");
    setSubmitting(false);
    setExtendOpen(false);
    fetchData();
  };

  const handleRevoke = async (sub: Sub) => {
    zarynConfirm({
      title: "Revoke VIP Status",
      message: `Are you sure you want to revoke VIP from ${(sub.profile as any)?.username || "this user"}?`,
      type: "vip",
      confirmLabel: "Revoke",
      onConfirm: async () => {
        const { error } = await supabase.from("user_subscriptions").update({ expires_at: new Date().toISOString() }).eq("id", sub.id);
        if (error) { toast.error(error.message); return; }
        await supabase.from("user_ad_settings").update({ ads_enabled: true, adblock_enforcement: true }).eq("user_id", sub.user_id);
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "VIP Status Changed",
          message: "Your VIP membership has been revoked by an administrator.",
          link: "/subscribe",
        });
        toast.success("VIP revoked");
        fetchData();
      },
    });
  };

  const handleMakeLifetime = async (sub: Sub) => {
    zarynConfirm({
      title: "👑 Upgrade to Lifetime VIP",
      message: `Make ${(sub.profile as any)?.username || "this user"} a Lifetime VIP?`,
      type: "vip",
      confirmLabel: "Upgrade",
      onConfirm: async () => {
        const { error } = await supabase.from("user_subscriptions").update({ expires_at: "2099-12-31T23:59:59Z" }).eq("id", sub.id);
        if (error) { toast.error(error.message); return; }
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "👑 Lifetime VIP!",
          message: "You've been upgraded to Lifetime VIP! Enjoy all benefits forever.",
          link: "/profile",
        });
        toast.success("Upgraded to Lifetime VIP!");
        fetchData();
      },
    });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const now = new Date();
  let filtered = subs.filter(s => {
    const isActive = new Date(s.expires_at) > now;
    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "expired" && isActive) return false;
    if (search) {
      const name = ((s.profile as any)?.username || "").toLowerCase();
      return name.includes(search.toLowerCase());
    }
    return true;
  });

  if (sortBy === "username") {
    filtered.sort((a, b) => ((a.profile as any)?.username || "").localeCompare((b.profile as any)?.username || ""));
  }

  const active = subs.filter(s => new Date(s.expires_at) > now);
  const expired = subs.filter(s => new Date(s.expires_at) <= now);

  const isLifetime = (expiresAt: string) => new Date(expiresAt).getFullYear() >= 2099;

  // Users not already VIP for the assign dialog
  const activeUserIds = new Set(active.map(s => s.user_id));
  const availableUsers = allProfiles.filter(p =>
    !activeUserIds.has(p.id) && (p.username || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2">
            <Crown className="h-7 w-7" /> VIP Members
          </h1>
          <p className="text-muted-foreground mt-1">
            {active.length} active, {expired.length} expired
          </p>
        </div>
        <Button onClick={() => { setAssignOpen(true); setAssignUserId(""); setAssignPlanId(""); setAssignLifetime(false); setAssignStartDate(new Date().toISOString().split("T")[0]); setUserSearch(""); }} className="gradient-brand text-primary-foreground">
          <UserPlus className="mr-1 h-4 w-4" /> Assign VIP
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by username..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-border/50 bg-background/50" />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[140px] border-border/50 bg-background/50">
            <Filter className="mr-1 h-4 w-4" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[160px] border-border/50 bg-background/50">
            <ArrowUpDown className="mr-1 h-4 w-4" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expires">Sort by Expiry</SelectItem>
            <SelectItem value="username">Sort by Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Plan</TableHead>
                <TableHead className="text-muted-foreground">Payment</TableHead>
                <TableHead className="text-muted-foreground">Start</TableHead>
                <TableHead className="text-muted-foreground">Expires</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const isActive = new Date(s.expires_at) > now;
                const lifetime = isLifetime(s.expires_at);
                return (
                  <TableRow key={s.id} className={`border-border/50 ${isActive ? "bg-amber-500/5" : ""}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(s.profile as any)?.avatar_url ? <img src={(s.profile as any).avatar_url} className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-muted" />}
                        <span className="font-medium text-foreground">{(s.profile as any)?.username || "—"}</span>
                        {isActive && <VipBadge />}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{(s.plan as any)?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{s.payment_method?.replace("_", " ") || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(s.starts_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{lifetime ? "♾️ Lifetime" : new Date(s.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={isActive ? "default" : "secondary"} className={`text-xs ${lifetime ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-0" : ""}`}>
                        {lifetime ? "Lifetime" : isActive ? "Active" : "Expired"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isActive && !lifetime && (
                          <>
                            <Button variant="ghost" size="sm" title="Extend" onClick={() => { setExtendSub(s); setExtendDays("30"); setExtendOpen(true); }}>
                              <CalendarPlus className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Make Lifetime" onClick={() => handleMakeLifetime(s)}>
                              <Crown className="h-4 w-4 text-amber-400" />
                            </Button>
                          </>
                        )}
                        {isActive && (
                          <Button variant="ghost" size="sm" title="Revoke" onClick={() => handleRevoke(s)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {!isActive && (
                          <Button variant="ghost" size="sm" title="Re-activate (extend)" onClick={() => { setExtendSub(s); setExtendDays("30"); setExtendOpen(true); }}>
                            <CalendarPlus className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No VIP members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign VIP Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Assign VIP Manually
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Search User</Label>
              <Input placeholder="Type username..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="border-border/50 bg-background/50" />
              {userSearch && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border/50 bg-background/50 divide-y divide-border/30">
                  {availableUsers.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => { setAssignUserId(p.id); setUserSearch(p.username || p.id); }} className={`w-full text-left px-3 py-2 hover:bg-primary/10 transition-colors flex items-center gap-2 ${assignUserId === p.id ? "bg-primary/10" : ""}`}>
                      {p.avatar_url ? <img src={p.avatar_url} className="h-5 w-5 rounded-full object-cover" /> : <div className="h-5 w-5 rounded-full bg-muted" />}
                      <span className="text-sm text-foreground">{p.username || "No username"}</span>
                    </button>
                  ))}
                  {availableUsers.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No users found</p>}
                </div>
              )}
              {assignUserId && !userSearch && (
                <p className="text-xs text-muted-foreground">Selected: {allProfiles.find(p => p.id === assignUserId)?.username}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Subscription Plan</Label>
              <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                <SelectTrigger className="border-border/50 bg-background/50"><SelectValue placeholder="Select a plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_days} days ({p.price} {p.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)} className="border-border/50 bg-background/50" />
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <input type="checkbox" checked={assignLifetime} onChange={e => setAssignLifetime(e.target.checked)} className="rounded" id="lifetime-check" />
              <label htmlFor="lifetime-check" className="text-sm text-foreground cursor-pointer flex items-center gap-1">
                <Crown className="h-4 w-4 text-amber-400" /> Make Lifetime VIP (never expires)
              </label>
            </div>

            {assignUserId && assignPlanId && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <p className="text-xs font-medium text-foreground">Preview</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-amber-400 font-bold">{allProfiles.find(p => p.id === assignUserId)?.username}</span>
                  <VipBadge size="sm" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Plan: {plans.find(p => p.id === assignPlanId)?.name} •
                  {assignLifetime ? " Lifetime ♾️" : ` Expires: ${new Date(getExpiry(assignPlanId, assignStartDate, false)).toLocaleDateString()}`}
                </p>
              </div>
            )}

            <Button onClick={handleAssign} disabled={!assignUserId || !assignPlanId || submitting} className="w-full gradient-brand text-primary-foreground">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Crown className="mr-1 h-4 w-4" />}
              Assign VIP
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" /> Extend VIP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Extending VIP for <span className="font-medium text-foreground">{(extendSub?.profile as any)?.username || "user"}</span>
            </p>
            <div className="space-y-1.5">
              <Label>Days to add</Label>
              <Input type="number" min="1" value={extendDays} onChange={e => setExtendDays(e.target.value)} className="border-border/50 bg-background/50" />
            </div>
            <Button onClick={handleExtend} disabled={submitting} className="w-full gradient-brand text-primary-foreground">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-1 h-4 w-4" />}
              Extend by {extendDays} days
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
