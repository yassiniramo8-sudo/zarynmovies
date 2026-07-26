import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Sparkles, Search, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface Highlight {
  id: string;
  title_en: string;
  title_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  teams: string[];
  match_date: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  categories: string[];
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  seo_slug: string | null;
  status: string;
  source: string | null;
  ai_generated: boolean | null;
  summary_type: string;
  created_at: string;
}

// Default types - admin can add custom ones
const DEFAULT_TYPES = ["sport", "movies", "technology", "entertainment", "gaming", "politics", "music", "health", "science", "education"];

const CATEGORIES = [
  "Premier League", "La Liga", "Champions League", "Serie A", "Bundesliga",
  "Ligue 1", "World Cup", "Africa Cup", "Botola Pro", "Friendly",
  "Europa League", "Conference League", "Copa America", "Euro",
  "Saudi Pro League", "MLS",
];

function extractYouTubeId(url: string): string {
  if (!url) return "";
  const match = url.match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : url.length === 11 ? url : "";
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminHighlights() {
  const [items, setItems] = useState<Highlight[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Highlight | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const [filterType, setFilterType] = useState<string>("all");
  const [customType, setCustomType] = useState("");

  // Derive all known types from existing data + defaults
  const [knownTypes, setKnownTypes] = useState<string[]>(DEFAULT_TYPES);

  const form_init = {
    title_en: "", title_ar: "", description_en: "", description_ar: "",
    teams: "", match_date: "", youtube_video_id: "", thumbnail_url: "",
    categories: [] as string[], tags: "",
    seo_title: "", seo_description: "", seo_keywords: "", seo_slug: "",
    status: "draft", summary_type: "sport",
  };

  const [form, setForm] = useState(form_init);

  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);

  const fetchItems = async () => {
    const { data } = await supabase.from("highlights").select("*").order("created_at", { ascending: false });
    const rows = (data as unknown as Highlight[]) || [];
    setItems(rows);
    // Merge existing types from DB
    const dbTypes = new Set(rows.map((h) => h.summary_type));
    setKnownTypes((prev) => {
      const merged = new Set([...prev, ...dbTypes]);
      return Array.from(merged).sort();
    });
  };

  useEffect(() => { fetchItems(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(form_init);
    setDialogOpen(true);
  };

  const openEdit = (h: any) => {
    setEditing(h);
    setForm({
      title_en: h.title_en, title_ar: h.title_ar || "", description_en: h.description_en || "",
      description_ar: h.description_ar || "", teams: h.teams?.join(", ") || "",
      match_date: h.match_date || "", youtube_video_id: h.youtube_video_id || "",
      thumbnail_url: h.thumbnail_url || "", categories: h.categories || [],
      tags: h.tags?.join(", ") || "",
      seo_title: h.seo_title || "", seo_description: h.seo_description || "",
      seo_keywords: h.seo_keywords || "", seo_slug: h.seo_slug || "",
      status: h.status, summary_type: h.summary_type || "sport",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title_en.trim()) { toast.error("English title is required"); return; }
    setLoading(true);

    const payload = {
      title_en: form.title_en.trim(),
      title_ar: form.title_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      teams: form.teams.split(",").map(t => t.trim()).filter(Boolean),
      match_date: form.match_date || null,
      youtube_video_id: extractYouTubeId(form.youtube_video_id),
      thumbnail_url: form.thumbnail_url || null,
      categories: form.categories,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      seo_title: form.seo_title.trim() || form.title_en.trim(),
      seo_description: form.seo_description.trim() || null,
      seo_keywords: form.seo_keywords.trim() || null,
      seo_slug: form.seo_slug.trim() || generateSlug(form.title_en),
      status: form.status,
      summary_type: form.summary_type,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      await supabase.from("highlights").update(payload).eq("id", editing.id);
      toast.success("Summary updated");
    } else {
      await supabase.from("highlights").insert({ ...payload, created_by: user?.id, source: "manual" });
      toast.success("Summary created");
    }

    setDialogOpen(false);
    setLoading(false);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this summary?")) return;
    await supabase.from("highlights").delete().eq("id", id);
    toast.success("Deleted");
    fetchItems();
  };

  const toggleStatus = async (h: Highlight) => {
    const newStatus = h.status === "published" ? "draft" : "published";
    await supabase.from("highlights").update({ status: newStatus }).eq("id", h.id);
    fetchItems();
  };

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-highlight-search", {
        body: { query: aiQuery },
      });
      if (error) throw error;
      setAiResults(data?.results || []);
      if (!data?.results?.length) toast.info("No results found.");
    } catch (e: any) {
      toast.error(e.message || "AI search failed");
    } finally {
      setAiLoading(false);
    }
  };

  const importAiResult = (r: any) => {
    setEditing(null);
    setForm({
      title_en: r.title_en || "", title_ar: r.title_ar || "",
      description_en: r.description_en || "", description_ar: r.description_ar || "",
      teams: r.teams?.join(", ") || "", match_date: r.match_date || "",
      youtube_video_id: r.youtube_video_id || "", thumbnail_url: r.thumbnail_url || "",
      categories: r.categories || [], tags: r.tags?.join(", ") || "",
      seo_title: r.seo_title || "", seo_description: r.seo_description || "",
      seo_keywords: r.seo_keywords || "", seo_slug: r.seo_slug || "",
      status: "draft", summary_type: "sport",
    });
    setAiDialogOpen(false);
    setDialogOpen(true);
  };

  const quickPublish = async (r: any) => {
    setLoading(true);
    const payload = {
      title_en: r.title_en || "",
      title_ar: r.title_ar || null,
      description_en: r.description_en || null,
      description_ar: r.description_ar || null,
      teams: r.teams || [],
      match_date: r.match_date || null,
      youtube_video_id: r.youtube_video_id || null,
      thumbnail_url: r.thumbnail_url || null,
      categories: r.categories || [],
      tags: r.tags || [],
      seo_title: r.seo_title || r.title_en || "",
      seo_description: r.seo_description || null,
      seo_keywords: r.seo_keywords || null,
      seo_slug: r.seo_slug || generateSlug(r.title_en || ""),
      status: "published",
      source: "ai",
      ai_generated: true,
      summary_type: "sport",
      source_channel: r.source_channel || null,
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("highlights").insert(payload);
    if (error) {
      toast.error("Failed to publish");
    } else {
      toast.success("Published!");
      fetchItems();
    }
    setLoading(false);
  };

  const addCustomType = () => {
    const t = customType.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !knownTypes.includes(t)) {
      setKnownTypes((prev) => [...prev, t].sort());
      setCustomType("");
      toast.success(`Type "${t}" added`);
    }
  };

  const filtered = items.filter((h) => {
    const matchesSearch = (h.title_en + (h.title_ar || "") + h.teams?.join(" ")).toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || h.summary_type === filterType;
    return matchesSearch && matchesType;
  });

  const getThumb = (h: Highlight) =>
    h.thumbnail_url || (h.youtube_video_id ? `https://img.youtube.com/vi/${h.youtube_video_id}/mqdefault.jpg` : null);

  // Unique types present in data for filter buttons
  const usedTypes = Array.from(new Set(items.map((h) => h.summary_type))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Summaries Management</h1>
          <p className="text-sm text-muted-foreground">{items.length} summaries · {usedTypes.length} types</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setAiDialogOpen(true); setAiResults([]); setAiQuery(""); }}>
            <Sparkles className="mr-2 h-4 w-4" /> AI Search
          </Button>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Add Summary
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search summaries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={filterType === "all" ? "default" : "outline"} onClick={() => setFilterType("all")}>All</Button>
          {usedTypes.map((t) => (
            <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"} onClick={() => setFilterType(t)} className="capitalize">
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Summaries List */}
      <div className="space-y-3">
        {filtered.map((h) => (
          <div key={h.id} className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-3">
            {getThumb(h) && (
              <img src={getThumb(h)!} alt={h.title_en} className="h-16 w-28 rounded-md object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{h.title_en}</p>
              {h.teams?.length > 0 && <p className="text-xs text-muted-foreground">{h.teams.join(" vs ")}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={h.status === "published" ? "default" : "secondary"} className="text-xs">
                  {h.status}
                </Badge>
                {h.ai_generated && <Badge variant="outline" className="text-xs">AI</Badge>}
                <Badge variant="outline" className="text-xs capitalize">{h.summary_type}</Badge>
                {h.match_date && <span className="text-xs text-muted-foreground">{h.match_date}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="icon" variant="ghost" onClick={() => toggleStatus(h)} title={h.status === "published" ? "Unpublish" : "Publish"}>
                {h.status === "published" ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(h)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No summaries yet.</p>}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Summary" : "Add Summary"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
              <TabsTrigger value="seo" className="flex-1">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Title (English) *</Label>
                  <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Title (Arabic)</Label>
                  <Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} dir="rtl" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Teams (comma-separated)</Label>
                  <Input value={form.teams} onChange={(e) => setForm({ ...form, teams: e.target.value })} placeholder="Real Madrid, Barcelona" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={form.match_date} onChange={(e) => setForm({ ...form, match_date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>YouTube Video URL or ID</Label>
                <Input value={form.youtube_video_id} onChange={(e) => setForm({ ...form, youtube_video_id: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
              </div>

              {extractYouTubeId(form.youtube_video_id) && (
                <div className="aspect-video rounded-lg overflow-hidden border border-border/50">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(form.youtube_video_id)}`}
                    className="h-full w-full"
                    title="YouTube preview"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope; web-share"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    loading="eager"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Custom Thumbnail</Label>
                <ImageUpload value={form.thumbnail_url} onChange={(url) => setForm({ ...form, thumbnail_url: url })} bucket="content" folder="highlights" />
              </div>

              <div className="space-y-1.5">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <Badge
                      key={c}
                      variant={form.categories.includes(c) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setForm({ ...form, categories: form.categories.includes(c) ? form.categories.filter(x => x !== c) : [...form.categories, c] })}
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Description (English)</Label>
                  <Textarea value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (Arabic)</Label>
                  <Textarea value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} rows={3} dir="rtl" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="football, highlights, goals" />
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                  <Label>Type</Label>
                  <Select value={form.summary_type} onValueChange={(v) => setForm({ ...form, summary_type: v })}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {knownTypes.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="New type..."
                    className="w-32 h-9"
                    onKeyDown={(e) => e.key === "Enter" && addCustomType()}
                  />
                  <Button size="sm" variant="outline" onClick={addCustomType}>+ Add</Button>
                </div>
                <div className="flex items-center gap-3">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>SEO Title</Label>
                <Input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>SEO Description</Label>
                <Textarea value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>SEO Keywords</Label>
                <Input value={form.seo_keywords} onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>SEO Slug</Label>
                <Input value={form.seo_slug} onChange={(e) => setForm({ ...form, seo_slug: e.target.value })} placeholder="auto-generated-from-title" />
                <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setForm({ ...form, seo_slug: generateSlug(form.title_en) })}>
                  Generate from title
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Search Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Summary Search
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Type a topic, team name, or keyword. AI will find the latest content automatically.
          </p>
          <div className="flex gap-2">
            <Input
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Type topic or keyword..."
              onKeyDown={(e) => e.key === "Enter" && handleAiSearch()}
              className="flex-1"
            />
            <Button onClick={handleAiSearch} disabled={aiLoading}>
              {aiLoading ? "Searching..." : "Search"}
            </Button>
          </div>

          {aiLoading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Searching for latest content...</p>
            </div>
          )}

          {aiResults.length > 0 && (
            <div className="space-y-3 mt-2">
              <p className="text-sm font-medium text-foreground">{aiResults.length} results found</p>
              {aiResults.map((r, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-card overflow-hidden">
                  <div className="flex gap-3 p-3">
                    {r.thumbnail_url && (
                      <img src={r.thumbnail_url} alt="" className="h-20 w-36 rounded-md object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2">{r.title_en}</p>
                      {r.title_ar && (
                        <p className="text-xs text-muted-foreground line-clamp-1" dir="rtl">{r.title_ar}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.teams?.length > 0 && <span className="text-xs text-muted-foreground">{r.teams.join(" vs ")}</span>}
                        {r.source_channel && <Badge variant="outline" className="text-xs">{r.source_channel}</Badge>}
                        {r.relevance_score && (
                          <span className="text-xs text-primary flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-primary" /> {r.relevance_score}/10
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/30 px-3 py-2 bg-muted/30">
                    <Button size="sm" variant="outline" onClick={() => importAiResult(r)} className="flex-1">
                      <Pencil className="mr-1.5 h-3 w-3" /> Edit & Import
                    </Button>
                    <Button size="sm" onClick={() => quickPublish(r)} disabled={loading} className="flex-1">
                      <Check className="mr-1.5 h-3 w-3" /> Quick Publish
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
