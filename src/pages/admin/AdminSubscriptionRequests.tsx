import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Eye, Clock } from "lucide-react";

export default function AdminSubscriptionRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [adminNote, setAdminNote] = useState("");

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("subscription_requests")
      .select("*, plan:subscription_plans(name, duration_days, price, currency), method:payment_methods(name), profile:user_id(username, avatar_url)")
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const openReview = (r: any) => { setSelected(r); setAdminNote(r.admin_note || ""); setReviewDialog(true); };

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!selected || !user) return;
    const { error } = await supabase.from("subscription_requests").update({
      status,
      admin_note: adminNote.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", selected.id);

    if (error) { toast.error(error.message); return; }

    if (status === "approved" && selected.plan) {
      const expiresAt = new Date(Date.now() + selected.plan.duration_days * 86400000).toISOString();
      await supabase.from("user_subscriptions").insert({
        user_id: selected.user_id,
        plan_id: selected.plan_id,
        expires_at: expiresAt,
        payment_method: selected.method?.name || "Unknown",
      });
      // Also disable ads for VIP user
      const { data: existing } = await supabase.from("user_ad_settings").select("id").eq("user_id", selected.user_id).maybeSingle();
      if (existing) {
        await supabase.from("user_ad_settings").update({ ads_enabled: false, adblock_enforcement: false }).eq("user_id", selected.user_id);
      } else {
        await supabase.from("user_ad_settings").insert({ user_id: selected.user_id, ads_enabled: false, adblock_enforcement: false });
      }
      // Send notification
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        title: "VIP Subscription Activated! 🎉",
        message: `Your ${selected.plan.name} subscription is now active. Enjoy ad-free browsing!`,
        link: "/profile",
      });
    }

    if (status === "rejected") {
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        title: "Subscription Request Update",
        message: `Your subscription request was not approved.${adminNote ? ` Note: ${adminNote}` : ""}`,
        link: "/subscribe",
      });
    }

    toast.success(`Request ${status}`);
    setReviewDialog(false);
    fetchRequests();
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "default";
    if (s === "rejected") return "destructive";
    return "secondary";
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2"><Clock className="h-7 w-7" /> Subscription Requests</h1>
        <p className="text-muted-foreground mt-1">{requests.filter(r => r.status === "pending").length} pending</p>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Plan</TableHead>
                <TableHead className="text-muted-foreground">Payment</TableHead>
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} className="border-border/50">
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {(r.profile as any)?.avatar_url ? <img src={(r.profile as any).avatar_url} className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-muted" />}
                      {(r.profile as any)?.username || "Unknown"}
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">{r.plan?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.method?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={statusColor(r.status)} className="text-xs capitalize">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openReview(r)}><Eye className="mr-1 h-4 w-4" /> Review</Button>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl max-w-lg">
          <DialogHeader><DialogTitle>Review Request</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">User:</span> <span className="text-foreground font-medium">{(selected.profile as any)?.username}</span></div>
                <div><span className="text-muted-foreground">Plan:</span> <span className="text-foreground font-medium">{selected.plan?.name}</span></div>
                <div><span className="text-muted-foreground">Price:</span> <span className="text-foreground font-medium">{selected.plan?.price} {selected.plan?.currency}</span></div>
                <div><span className="text-muted-foreground">Method:</span> <span className="text-foreground font-medium">{selected.method?.name}</span></div>
              </div>
              {selected.proof_url && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Payment Proof</Label>
                  <a href={selected.proof_url} target="_blank" rel="noopener noreferrer">
                    <img src={selected.proof_url} alt="Proof" className="max-h-48 rounded-lg border border-border/50 object-contain cursor-pointer hover:opacity-80 transition-opacity" />
                  </a>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Admin Note (optional)</Label>
                <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Note..." className="border-border/50 bg-background/50" />
              </div>
              {selected.status === "pending" ? (
                <div className="flex gap-2">
                  <Button onClick={() => handleDecision("approved")} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button onClick={() => handleDecision("rejected")} variant="destructive" className="flex-1">
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                </div>
              ) : (
                <Badge variant={statusColor(selected.status)} className="text-sm capitalize">{selected.status}</Badge>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
