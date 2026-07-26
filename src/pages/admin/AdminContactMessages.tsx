import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import { Mail, Trash2, Reply, Eye, Clock, CheckCircle2, Loader2, Search, Globe, Plus, X } from "lucide-react";

export default function AdminContactMessages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "replied">("all");
  const [replyDialog, setReplyDialog] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  // Social links management
  const [socialDialog, setSocialDialog] = useState(false);
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>([]);
  const [savingSocial, setSavingSocial] = useState(false);

  const fetchMessages = async () => {
    const { data } = await supabase.from("contact_messages" as any).select("*").order("created_at", { ascending: false });
    setMessages((data as any[]) || []);
    setLoading(false);
  };

  const fetchSocialLinks = async () => {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "social_links").single();
    if (data?.value) {
      try { setSocialLinks(JSON.parse(data.value)); } catch {}
    }
  };

  useEffect(() => { fetchMessages(); fetchSocialLinks(); }, []);

  const handleMarkRead = async (msg: any) => {
    await supabase.from("contact_messages" as any).update({ status: "read" } as any).eq("id", msg.id);
    fetchMessages();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedMsg) return;
    setReplying(true);
    await supabase.from("contact_messages" as any).update({ admin_reply: replyText.trim(), status: "replied", replied_at: new Date().toISOString() } as any).eq("id", selectedMsg.id);
    setReplying(false);
    setReplyDialog(false);
    setReplyText("");
    toast.success("Reply saved");
    fetchMessages();
  };

  const handleDelete = async (id: string) => {
    zarynConfirm({
      title: "Delete Message",
      message: "Are you sure you want to delete this contact message?",
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await supabase.from("contact_messages" as any).delete().eq("id", id);
        toast.success("Deleted");
        fetchMessages();
      },
    });
  };

  const handleSaveSocialLinks = async () => {
    setSavingSocial(true);
    const filtered = socialLinks.filter(l => l.platform.trim() && l.url.trim());
    const { error } = await supabase.from("site_settings").upsert({ key: "social_links", value: JSON.stringify(filtered) }, { onConflict: "key" });
    setSavingSocial(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Social links saved");
    setSocialDialog(false);
  };

  const filtered = messages.filter((m: any) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (search && !m.name?.toLowerCase().includes(search.toLowerCase()) && !m.email?.toLowerCase().includes(search.toLowerCase()) && !m.subject?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Contact Messages
          </h1>
          <p className="text-sm text-muted-foreground">{messages.length} total messages</p>
        </div>
        <Button onClick={() => setSocialDialog(true)} variant="outline" className="border-primary/50 text-primary">
          <Globe className="mr-2 h-4 w-4" /> Social Links
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..." className="pl-9 border-border/50 bg-background/50" />
        </div>
        <div className="flex gap-2">
          {(["all", "unread", "read", "replied"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No messages found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m: any) => (
            <Card key={m.id} className={`border-border/50 bg-card/50 ${m.status === "unread" ? "border-l-4 border-l-primary" : ""}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{m.subject}</h3>
                      <Badge variant={m.status === "unread" ? "default" : m.status === "replied" ? "secondary" : "outline"} className="text-[10px] capitalize">
                        {m.status === "unread" && <Clock className="mr-1 h-2.5 w-2.5" />}
                        {m.status === "replied" && <CheckCircle2 className="mr-1 h-2.5 w-2.5" />}
                        {m.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{m.name} &lt;{m.email}&gt;</p>
                    <p className="text-sm text-foreground/80 mt-2 line-clamp-2">{m.message}</p>
                    {m.admin_reply && (
                      <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                        <p className="text-xs text-muted-foreground">Admin reply:</p>
                        <p className="text-sm text-foreground/80">{m.admin_reply}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {m.status === "unread" && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkRead(m)}><Eye className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setSelectedMsg(m); setReplyText(m.admin_reply || ""); setReplyDialog(true); }}>
                      <Reply className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog open={replyDialog} onOpenChange={setReplyDialog}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader><DialogTitle>Reply to {selectedMsg?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/50 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">Subject: {selectedMsg?.subject}</p>
              <p className="text-sm text-foreground mt-1">{selectedMsg?.message}</p>
            </div>
            <div className="space-y-2">
              <Label>Your Reply</Label>
              <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} className="border-border/50 bg-background/50 resize-none" />
            </div>
            <Button onClick={handleReply} disabled={replying || !replyText.trim()} className="w-full gradient-brand text-primary-foreground">
              {replying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Reply className="mr-2 h-4 w-4" />}
              Save Reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Social Links Dialog */}
      <Dialog open={socialDialog} onOpenChange={setSocialDialog}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader><DialogTitle>Manage Social Links</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {socialLinks.map((link, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={link.platform} onChange={e => { const n = [...socialLinks]; n[i].platform = e.target.value; setSocialLinks(n); }} placeholder="Platform (e.g. Twitter)" className="border-border/50 bg-background/50 flex-1" />
                <Input value={link.url} onChange={e => { const n = [...socialLinks]; n[i].url = e.target.value; setSocialLinks(n); }} placeholder="URL" className="border-border/50 bg-background/50 flex-[2]" />
                <Button size="icon" variant="ghost" onClick={() => setSocialLinks(socialLinks.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => setSocialLinks([...socialLinks, { platform: "", url: "" }])} className="w-full border-dashed">
              <Plus className="mr-2 h-4 w-4" /> Add Link
            </Button>
            <Button onClick={handleSaveSocialLinks} disabled={savingSocial} className="w-full gradient-brand text-primary-foreground">
              {savingSocial ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Social Links
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
