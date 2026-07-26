import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import { Plus, Pencil, Trash2, Loader2, FolderOpen, Film } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface AnimeGroup {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  sort_order: number;
  created_at: string;
  anime_count?: number;
}

interface AnimeItem {
  id: string;
  title: string;
  poster_url: string | null;
  group_id: string | null;
  episode_number: number | null;
}

export default function AdminAnimeGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<AnimeGroup[]>([]);
  const [allAnime, setAllAnime] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnimeGroup | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const fetchData = async () => {
    const [groupsRes, animeRes] = await Promise.all([
      supabase.from("anime_groups").select("*").order("sort_order"),
      supabase.from("anime").select("id, title, poster_url, group_id, episode_number").order("episode_number"),
    ]);

    const groupList = (groupsRes.data || []) as any[];
    const animeList = (animeRes.data || []) as AnimeItem[];

    // Count anime per group
    const counts: Record<string, number> = {};
    animeList.forEach((a) => { if (a.group_id) counts[a.group_id] = (counts[a.group_id] || 0) + 1; });
    const enriched = groupList.map((g) => ({ ...g, anime_count: counts[g.id] || 0 }));

    setGroups(enriched);
    setAllAnime(animeList);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm({}); setDialogOpen(true); };
  const openEdit = (g: AnimeGroup) => {
    setEditing(g);
    setForm({ title: g.title, description: g.description || "", poster_url: g.poster_url || "", sort_order: g.sort_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      poster_url: form.poster_url || null,
      sort_order: Number(form.sort_order) || 0,
    };

    if (editing) {
      const { error } = await supabase.from("anime_groups").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Group updated");
    } else {
      const { error } = await supabase.from("anime_groups").insert({ ...payload, created_by: user?.id } as any);
      if (error) toast.error(error.message); else toast.success("Group created");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    zarynConfirm({
      title: "Delete Group",
      message: "Anime in this group will become ungrouped. Continue?",
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await supabase.from("anime").update({ group_id: null }).eq("group_id", id);
        const { error } = await supabase.from("anime_groups").delete().eq("id", id);
        if (error) toast.error(error.message); else { toast.success("Deleted"); fetchData(); }
      },
    });
  };

  const assignAnime = async (animeId: string, groupId: string | null, episodeNumber?: number) => {
    const update: any = { group_id: groupId };
    if (episodeNumber !== undefined) update.episode_number = episodeNumber;
    const { error } = await supabase.from("anime").update(update).eq("id", animeId);
    if (error) toast.error(error.message); else fetchData();
  };

  const groupAnime = allAnime.filter((a) => a.group_id === selectedGroup);
  const ungrouped = allAnime.filter((a) => !a.group_id);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">Anime Groups</h1>
          <p className="text-muted-foreground mt-1">{groups.length} groups · {ungrouped.length} ungrouped anime</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-brand text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg border-border/50 bg-card/95 backdrop-blur-xl">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Create"} Group</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <ImageUpload bucket="content" folder="anime-groups" value={form.poster_url || ""} onChange={(url) => setForm({ ...form, poster_url: url })} label="Group Poster" />
              <div className="space-y-1.5">
                <Label className="text-foreground">Title</Label>
                <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border-border/50 bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Description</Label>
                <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border-border/50 bg-background/50" rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground">Sort Order</Label>
                <Input type="number" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="border-border/50 bg-background/50" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full gradient-brand text-primary-foreground">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Groups list */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-foreground">Groups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedGroup === g.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedGroup(selectedGroup === g.id ? null : g.id)}
              >
                {g.poster_url ? (
                  <img src={g.poster_url} alt={g.title} className="h-12 w-9 rounded object-cover" />
                ) : (
                  <div className="h-12 w-9 rounded bg-muted flex items-center justify-center"><FolderOpen className="h-4 w-4 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{g.title}</p>
                  <p className="text-xs text-muted-foreground">{g.anime_count} anime</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(g); }}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No groups yet</p>}
          </CardContent>
        </Card>

        {/* Group contents / assignment */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-foreground">
                {selectedGroup ? groups.find((g) => g.id === selectedGroup)?.title || "Group" : "Ungrouped Anime"}
              </CardTitle>
              {selectedGroup && (
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Add Anime</Button>
                  </DialogTrigger>
                  <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
                    <DialogHeader><DialogTitle>Add Anime to Group</DialogTitle></DialogHeader>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {ungrouped.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                          {a.poster_url ? <img src={a.poster_url} alt={a.title} className="h-10 w-7 rounded object-cover" /> : <div className="h-10 w-7 rounded bg-muted" />}
                          <span className="flex-1 text-sm text-foreground truncate">{a.title}</span>
                          <Button size="sm" variant="outline" onClick={() => { assignAnime(a.id, selectedGroup); setAssignDialogOpen(false); }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {ungrouped.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">All anime are grouped</p>}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(selectedGroup ? groupAnime : ungrouped).map((a, idx) => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                {a.poster_url ? <img src={a.poster_url} alt={a.title} className="h-10 w-7 rounded object-cover" /> : <div className="h-10 w-7 rounded bg-muted" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground truncate block">{a.title}</span>
                  {a.episode_number && <span className="text-xs text-muted-foreground">Ep. {a.episode_number}</span>}
                </div>
                {selectedGroup ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Ep#"
                      value={a.episode_number || ""}
                      onChange={(e) => assignAnime(a.id, selectedGroup, Number(e.target.value) || undefined)}
                      className="w-16 h-8 text-xs border-border/50 bg-background/50"
                    />
                    <Button size="sm" variant="ghost" onClick={() => assignAnime(a.id, null)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <Select onValueChange={(gId) => assignAnime(a.id, gId)}>
                    <SelectTrigger className="w-32 h-8 text-xs border-border/50 bg-background/50"><SelectValue placeholder="Assign..." /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
            {(selectedGroup ? groupAnime : ungrouped).length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">
                {selectedGroup ? "No anime in this group yet" : "No ungrouped anime"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
