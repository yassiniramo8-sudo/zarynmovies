import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import {
  Trash2, Pin, Loader2, MessageCircle, ThumbsUp, ThumbsDown,
  CornerDownRight, Shield, Clock, Users, AlertTriangle, Search,
  Ban, Timer, RefreshCw
} from "lucide-react";

interface Comment {
  id: string;
  body: string;
  content_type: string;
  content_id: string;
  user_id: string;
  parent_id: string | null;
  pinned: boolean | null;
  highlighted: boolean | null;
  highlight_color: string | null;
  created_at: string;
  username?: string | null;
  likes: number;
  dislikes: number;
  reply_count: number;
}

interface UserSummary {
  user_id: string;
  username: string | null;
  comment_count: number;
  last_comment_at: string;
  is_banned: boolean;
  ban_expires: string | null;
}

export default function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "root" | "replies">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [commentDelay, setCommentDelay] = useState(5);
  const [delayLoading, setDelayLoading] = useState(false);
  const [aiModEnabled, setAiModEnabled] = useState(true);
  const { t } = useLanguage();

  const fetchComments = useCallback(async () => {
    const [commentsRes, profilesRes, likesRes, bansRes, delaySetting, modSetting] = await Promise.all([
      supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id, username"),
      supabase.from("comment_likes").select("comment_id, like_type"),
      supabase.from("user_bans").select("user_id, expires_at, ban_type"),
      supabase.from("site_settings").select("value").eq("key", "comment_delay_seconds").single(),
      supabase.from("site_settings").select("value").eq("key", "ai_comment_moderation").single(),
    ]);

    setCommentDelay(parseInt(delaySetting.data?.value || "5"));
    setAiModEnabled(modSetting.data?.value !== "false");

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p.username]));

    // Active bans
    const activeBans = new Map<string, string | null>();
    (bansRes.data || []).forEach((b) => {
      if (b.ban_type === "comment" || b.ban_type === "full") {
        if (!b.expires_at || new Date(b.expires_at) > new Date()) {
          activeBans.set(b.user_id, b.expires_at);
        }
      }
    });

    // Like counts
    const likeCounts: Record<string, { likes: number; dislikes: number }> = {};
    (likesRes.data || []).forEach((l) => {
      if (!likeCounts[l.comment_id]) likeCounts[l.comment_id] = { likes: 0, dislikes: 0 };
      if (l.like_type === "like") likeCounts[l.comment_id].likes++;
      else likeCounts[l.comment_id].dislikes++;
    });

    // Reply counts
    const replyCounts: Record<string, number> = {};
    (commentsRes.data || []).forEach((c) => {
      if (c.parent_id) replyCounts[c.parent_id] = (replyCounts[c.parent_id] || 0) + 1;
    });

    const enriched: Comment[] = (commentsRes.data || []).map((c) => ({
      ...c,
      username: profileMap.get(c.user_id),
      likes: likeCounts[c.id]?.likes || 0,
      dislikes: likeCounts[c.id]?.dislikes || 0,
      reply_count: replyCounts[c.id] || 0,
    }));

    setComments(enriched);

    // Build user summaries
    const userMap = new Map<string, UserSummary>();
    enriched.forEach((c) => {
      const existing = userMap.get(c.user_id);
      if (existing) {
        existing.comment_count++;
        if (new Date(c.created_at) > new Date(existing.last_comment_at)) {
          existing.last_comment_at = c.created_at;
        }
      } else {
        userMap.set(c.user_id, {
          user_id: c.user_id,
          username: c.username || null,
          comment_count: 1,
          last_comment_at: c.created_at,
          is_banned: activeBans.has(c.user_id),
          ban_expires: activeBans.get(c.user_id) || null,
        });
      }
    });
    setUsers(Array.from(userMap.values()).sort((a, b) => b.comment_count - a.comment_count));
    setLoading(false);
  }, []);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Realtime subscription via centralized manager
  useEffect(() => {
    const unsub = realtimeManager.subscribe("admin-comments", {
      tables: [{ schema: "public", table: "comments" }],
      onChange: () => fetchComments(),
    });
    return () => { unsub(); };
  }, [fetchComments]);

  const updateDelay = async (value: number) => {
    setDelayLoading(true);
    setCommentDelay(value);
    await supabase
      .from("site_settings")
      .update({ value: String(value), updated_at: new Date().toISOString() })
      .eq("key", "comment_delay_seconds");
    setDelayLoading(false);
    toast.success(`Comment delay set to ${value}s`);
  };

  const toggleAiMod = async (enabled: boolean) => {
    setAiModEnabled(enabled);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "ai_comment_moderation", value: enabled ? "true" : "false", updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else toast.success(enabled ? "AI moderation enabled" : "AI moderation disabled");
  };

  const togglePin = async (c: Comment) => {
    const { error } = await supabase.from("comments").update({ pinned: !c.pinned }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(c.pinned ? "Unpinned" : "Pinned"); fetchComments(); }
  };

  const setHighlight = async (c: Comment, color: string | null) => {
    const { error } = await supabase.from("comments").update({ highlighted: !!color, highlight_color: color }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(color ? "Highlighted" : "Highlight removed"); fetchComments(); }
  };

  const handleDelete = async (id: string) => {
    zarynConfirm({
      title: "Delete Comment",
      message: "Delete this comment and all its replies?",
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: async () => {
        // Delete replies first
        await supabase.from("comments").delete().eq("parent_id", id);
        const { error } = await supabase.from("comments").delete().eq("id", id);
        if (error) toast.error(error.message);
        else { toast.success("Deleted"); fetchComments(); }
      },
    });
  };

  const resetLikes = async (commentId: string) => {
    const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId);
    if (error) toast.error(error.message);
    else { toast.success("Likes reset"); fetchComments(); }
  };

  const banUserComments = async (userId: string, duration: string) => {
    let expiresAt: string | null = null;
    if (duration !== "permanent") {
      const mins = parseInt(duration);
      expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();
    }
    const { error } = await supabase.from("user_bans").insert({
      user_id: userId,
      ban_type: "comment",
      reason: "Suspended from commenting by admin",
      expires_at: expiresAt,
      banned_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success(duration === "permanent" ? "User permanently banned from commenting" : `User banned for ${duration} minutes`); fetchComments(); }
  };

  const unbanUser = async (userId: string) => {
    const { error } = await supabase.from("user_bans").delete().eq("user_id", userId).in("ban_type", ["comment"]);
    if (error) toast.error(error.message);
    else { toast.success("User unbanned"); fetchComments(); }
  };

  const filtered = comments.filter((c) => {
    const matchFilter = filter === "all" || (filter === "root" ? !c.parent_id : !!c.parent_id);
    const matchSearch = !searchQuery || c.body.toLowerCase().includes(searchQuery.toLowerCase()) || (c.username || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">{t("admin.comments")}</h1>
          <p className="text-muted-foreground mt-1">{comments.length} total · {users.length} users</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchComments}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      {/* Controls Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium text-foreground">Comment Delay</Label>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={300}
                value={commentDelay}
                onChange={(e) => setCommentDelay(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 h-8 text-sm border-border/50 bg-background/50"
              />
              <span className="text-xs text-muted-foreground">seconds</span>
              <Button size="sm" variant="outline" disabled={delayLoading} onClick={() => updateDelay(commentDelay)}>
                {delayLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium text-foreground">AI Moderation</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={aiModEnabled} onCheckedChange={toggleAiMod} />
              <span className="text-xs text-muted-foreground">{aiModEnabled ? "Active — auto-detecting toxic & spam" : "Disabled"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <Label className="text-sm font-medium text-foreground">Stats</Label>
            </div>
            <div className="flex gap-4 text-sm">
              <div><span className="text-foreground font-medium">{comments.filter(c => !c.parent_id).length}</span><span className="text-muted-foreground ml-1">comments</span></div>
              <div><span className="text-foreground font-medium">{comments.filter(c => c.parent_id).length}</span><span className="text-muted-foreground ml-1">replies</span></div>
              <div><span className="text-foreground font-medium">{users.filter(u => u.is_banned).length}</span><span className="text-destructive ml-1">banned</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="comments" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="comments" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comments</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
        </TabsList>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search comments or users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 border-border/50 bg-background/50" />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-32 border-border/50 bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="root">Root only</SelectItem>
                <SelectItem value="replies">Replies only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Comment</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Engagement</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Color</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((c) => (
                    <TableRow key={c.id} className="border-border/50">
                      <TableCell className="text-foreground text-sm">{c.username || "—"}</TableCell>
                      <TableCell className="text-foreground text-sm max-w-[200px]">
                        <div className="flex items-center gap-1">
                          {c.parent_id && <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className="truncate">{c.body}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs border-border/50">{c.content_type}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-0.5 text-primary"><ThumbsUp className="h-3 w-3" /> {c.likes}</span>
                          <span className="flex items-center gap-0.5 text-destructive"><ThumbsDown className="h-3 w-3" /> {c.dislikes}</span>
                          {c.reply_count > 0 && <span className="flex items-center gap-0.5 text-muted-foreground"><MessageCircle className="h-3 w-3" /> {c.reply_count}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {c.pinned && <Badge className="text-xs bg-primary/20 text-primary">Pinned</Badge>}
                          {c.highlighted && <Badge className="text-xs" style={{ backgroundColor: c.highlight_color || undefined }}>Highlighted</Badge>}
                          {c.parent_id && <Badge variant="outline" className="text-xs border-muted-foreground/30">Reply</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={c.highlight_color || "none"} onValueChange={(v) => setHighlight(c, v === "none" ? null : v)}>
                          <SelectTrigger className="w-24 h-8 text-xs border-border/50 bg-background/50"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="#facc15">Yellow</SelectItem>
                            <SelectItem value="#60a5fa">Blue</SelectItem>
                            <SelectItem value="#f87171">Red</SelectItem>
                            <SelectItem value="#4ade80">Green</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => togglePin(c)} title={c.pinned ? "Unpin" : "Pin"}>
                            <Pin className={`h-4 w-4 ${c.pinned ? "text-primary" : "text-muted-foreground"}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => resetLikes(c.id)} title="Reset likes">
                            <ThumbsDown className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No comments found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Comments</TableHead>
                    <TableHead className="text-muted-foreground">Last Active</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id} className="border-border/50">
                      <TableCell className="text-foreground text-sm font-medium">{u.username || "—"}</TableCell>
                      <TableCell className="text-foreground text-sm">{u.comment_count}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(u.last_comment_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {u.is_banned ? (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            {u.ban_expires ? `Until ${new Date(u.ban_expires).toLocaleDateString()}` : "Permanent"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-primary border-primary/30">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {u.is_banned ? (
                            <Button size="sm" variant="outline" onClick={() => unbanUser(u.user_id)} className="text-xs h-7">
                              Unban
                            </Button>
                          ) : (
                            <Select onValueChange={(v) => banUserComments(u.user_id, v)}>
                              <SelectTrigger className="w-28 h-7 text-xs border-border/50 bg-background/50">
                                <SelectValue placeholder="Suspend..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30 min</SelectItem>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="1440">24 hours</SelectItem>
                                <SelectItem value="10080">7 days</SelectItem>
                                <SelectItem value="permanent">Permanent</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No commenting users yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
