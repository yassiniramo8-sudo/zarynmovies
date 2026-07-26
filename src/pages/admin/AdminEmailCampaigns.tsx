import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Mail, Send, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminEmailCampaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleSave = async (send = false) => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Error", description: "Subject and body are required", variant: "destructive" });
      return;
    }
    setSending(true);
    const payload: any = {
      subject,
      body,
      target_audience: audience,
      status: send ? "sent" : "draft",
      ...(send ? { sent_at: new Date().toISOString(), sent_by: user?.id } : {}),
    };

    const { error } = await supabase.from("email_campaigns").insert(payload as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (send) {
        // Trigger edge function to send emails
        await supabase.functions.invoke("send-email-campaign", {
          body: { subject, body, target_audience: audience },
        });
      }
      toast({ title: send ? "Campaign Sent!" : "Draft Saved" });
      setDialogOpen(false);
      setSubject("");
      setBody("");
      setAudience("all");
      fetchCampaigns();
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("email_campaigns").delete().eq("id", id);
    toast({ title: "Campaign deleted" });
    fetchCampaigns();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">Send targeted emails to your users</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gradient-brand text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> New Campaign
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{campaigns.length}</p>
              <p className="text-xs text-muted-foreground">Total Campaigns</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <Send className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{campaigns.filter(c => c.status === "sent").length}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <Mail className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{campaigns.filter(c => c.status === "draft").length}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.subject}</TableCell>
                  <TableCell className="capitalize">{c.target_audience}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "sent" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.sent_at || c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No campaigns yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Email Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
            <Textarea placeholder="Email body (HTML supported)" value={body} onChange={e => setBody(e.target.value)} rows={8} />
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="vip">VIP Members Only</SelectItem>
                <SelectItem value="non_vip">Non-VIP Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={sending}>Save Draft</Button>
            <Button onClick={() => handleSave(true)} disabled={sending} className="gradient-brand text-primary-foreground">
              <Send className="mr-2 h-4 w-4" /> Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
