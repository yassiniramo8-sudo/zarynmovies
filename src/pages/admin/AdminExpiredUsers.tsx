import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import {
  Loader2, UserX, Search, Filter, Trash2, ShieldOff, Bell,
  Archive, CheckSquare, Square, AlertTriangle, Crown,
} from "lucide-react";

interface ExpiredUser {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  plan_name: string | null;
  expires_at: string;
  was_vip: boolean;
}

export default function AdminExpiredUsers() {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<ExpiredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState("");
  const [vipFilter, setVipFilter] = useState<"all" | "vip" | "non-vip">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk action dialog
  const [actionDialog, setActionDialog] = useState<"delete" | "revoke" | null>(null);
  const [archiveEnabled, setArchiveEnabled] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [reason, setReason] = useState("");

  const fetchExpiredUsers = async () => {
    setLoading(true);
    const now = new Date().toISOString();

    // Get all expired subscriptions
    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("user_id, expires_at, plan:subscription_plans(name)")
      .lt("expires_at", now)
      .order("expires_at", { ascending: true });

    if (!subs || subs.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Get unique user IDs with their latest expired subscription
    const userMap = new Map<string, { expires_at: string; plan_name: string | null }>();
    for (const s of subs) {
      const existing = userMap.get(s.user_id);
      if (!existing || new Date(s.expires_at) > new Date(existing.expires_at)) {
        userMap.set(s.user_id, {
          expires_at: s.expires_at,
          plan_name: (s.plan as any)?.name || null,
        });
      }
    }

    // Check if any of these users have an ACTIVE subscription too (exclude them)
    const { data: activeSubs } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .gt("expires_at", now);

    const activeUserIds = new Set((activeSubs || []).map(s => s.user_id));

    // Filter out users who also have active subscriptions
    const expiredOnly = Array.from(userMap.entries()).filter(([uid]) => !activeUserIds.has(uid));

    // Get profiles
    const userIds = expiredOnly.map(([uid]) => uid);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const result: ExpiredUser[] = expiredOnly.map(([uid, sub]) => {
      const profile = profileMap.get(uid);
      return {
        user_id: uid,
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        plan_name: sub.plan_name,
        expires_at: sub.expires_at,
        was_vip: true, // They had a subscription, so they were VIP
      };
    });

    setUsers(result);
    setLoading(false);
  };

  useEffect(() => { fetchExpiredUsers(); }, []);

  const toggleSelect = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(u => u.user_id)));
    }
  };

  const executeBulkAction = async (action: "delete" | "revoke_vip") => {
    if (selected.size === 0) return;
    setProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-expired-users", {
        body: {
          action,
          user_ids: Array.from(selected),
          archive: archiveEnabled,
          notify: notifyEnabled,
          reason: reason || undefined,
        },
      });

      if (error) throw error;

      if (data?.errors?.length > 0) {
        toast.error(`Completed with ${data.errors.length} errors`);
        console.error("Bulk action errors:", data.errors);
      }

      if (action === "delete") {
        toast.success(`${data?.deleted || 0} users deleted${data?.archived ? `, ${data.archived} archived` : ""}`);
      } else {
        toast.success(`${data?.revoked || 0} VIP badges revoked`);
      }

      setSelected(new Set());
      setActionDialog(null);
      setReason("");
      fetchExpiredUsers();
    } catch (e: any) {
      toast.error(e.message || "Operation failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) { toast.error("No users selected"); return; }
    setActionDialog("delete");
  };

  const handleBulkRevoke = () => {
    if (selected.size === 0) { toast.error("No users selected"); return; }
    setActionDialog("revoke");
  };

  const handleSingleDelete = (u: ExpiredUser) => {
    zarynConfirm({
      title: "Delete User",
      message: `Permanently delete ${u.username || "this user"} and all their data?`,
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: () => {
        setSelected(new Set([u.user_id]));
        setActionDialog("delete");
      },
    });
  };

  // Filtering
  const filtered = users.filter(u => {
    if (search) {
      const q = search.toLowerCase();
      if (!(u.username || "").toLowerCase().includes(q) && !(u.plan_name || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (vipFilter === "vip" && !u.was_vip) return false;
    if (vipFilter === "non-vip" && u.was_vip) return false;
    return true;
  });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2">
            <UserX className="h-7 w-7" /> Expired Subscriptions
          </h1>
          <p className="text-muted-foreground mt-1">
            {users.length} users with expired or cancelled subscriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              {selected.size} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by username or plan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-border/50 bg-background/50" />
        </div>
        <Select value={vipFilter} onValueChange={(v: any) => setVipFilter(v)}>
          <SelectTrigger className="w-[140px] border-border/50 bg-background/50">
            <Filter className="mr-1 h-4 w-4" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="vip">Was VIP</SelectItem>
            <SelectItem value="non-vip">Non-VIP</SelectItem>
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1">
              <Trash2 className="h-4 w-4" /> Delete ({selected.size})
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkRevoke} className="gap-1 border-amber-500/40 text-amber-500 hover:bg-amber-500/10">
              <ShieldOff className="h-4 w-4" /> Revoke VIP ({selected.size})
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <UserX className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No expired subscription users found</p>
              <p className="text-xs mt-1">All users have active subscriptions or no subscriptions at all.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-12">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {selected.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Plan</TableHead>
                  <TableHead className="text-muted-foreground">Expired</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => {
                  const daysSinceExpiry = Math.floor((Date.now() - new Date(u.expires_at).getTime()) / (1000 * 60 * 60 * 24));
                  const isOld = daysSinceExpiry > 90;
                  return (
                    <TableRow
                      key={u.user_id}
                      className={`border-border/50 transition-colors ${
                        selected.has(u.user_id) ? "bg-primary/5" : ""
                      } ${isOld ? "bg-destructive/5" : ""}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(u.user_id)}
                          onCheckedChange={() => toggleSelect(u.user_id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                              <UserX className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium text-foreground">{u.username || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground text-sm">{u.plan_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">
                            {new Date(u.expires_at).toLocaleDateString()}
                          </span>
                          <span className={`text-[10px] ${isOld ? "text-destructive" : "text-muted-foreground/60"}`}>
                            {daysSinceExpiry} days ago
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs bg-muted/80 text-muted-foreground">
                            Expired
                          </Badge>
                          {isOld && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="mr-0.5 h-3 w-3" /> 90d+
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" title="Delete user" onClick={() => handleSingleDelete(u)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setReason(""); }}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog === "delete" ? (
                <><Trash2 className="h-5 w-5 text-destructive" /> Delete {selected.size} User{selected.size > 1 ? "s" : ""}</>
              ) : (
                <><Crown className="h-5 w-5 text-amber-400" /> Revoke VIP for {selected.size} User{selected.size > 1 ? "s" : ""}</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {actionDialog === "delete" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> This action is permanent
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All user data including profiles, watchlists, comments, ratings, and subscriptions will be permanently deleted.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Send notification to users</Label>
                </div>
                <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} />
              </div>

              {actionDialog === "delete" && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Archive for record keeping</Label>
                  </div>
                  <Switch checked={archiveEnabled} onCheckedChange={setArchiveEnabled} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                <Textarea
                  placeholder="e.g., Expired subscription cleanup..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="border-border/50 bg-background/50 text-sm min-h-[60px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setActionDialog(null); setReason(""); }}>Cancel</Button>
              <Button
                variant={actionDialog === "delete" ? "destructive" : "default"}
                className={actionDialog === "revoke" ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-600 hover:to-yellow-500" : ""}
                onClick={() => executeBulkAction(actionDialog === "delete" ? "delete" : "revoke_vip")}
                disabled={processing}
              >
                {processing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {actionDialog === "delete" ? "Delete Users" : "Revoke VIP"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
