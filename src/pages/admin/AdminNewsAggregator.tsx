import { useState, useEffect } from "react";
import { Rss, Plus, Trash2, RefreshCw, Loader2, Power, PowerOff, Globe, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewsSource {
  id: string;
  name: string;
  url: string;
  source_type: string;
  category: string;
  language: string;
  active: boolean;
  last_fetched_at: string | null;
  fetch_interval_hours: number;
  sort_order: number;
}

interface FetchResult {
  source: string;
  found: number;
  new: number;
}

const CATEGORIES = ["general", "politics", "sports", "technology", "economy", "entertainment", "culture", "health", "science"];

export default function AdminNewsAggregator() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchingSingle, setFetchingSingle] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastResults, setLastResults] = useState<{ results: FetchResult[]; errors: string[]; fetched: number } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const [form, setForm] = useState({ name: "", url: "", category: "general", language: "ar", fetch_interval_hours: "24" });

  const loadSources = async () => {
    const { data } = await supabase.from("news_sources").select("*").order("sort_order");
    setSources((data as any[]) || []);
    setLoading(false);
  };

  const loadPendingCount = async () => {
    const { count } = await supabase.from("sports_news").select("*", { count: "exact", head: true }).eq("status", "draft");
    setPendingCount(count || 0);
  };

  useEffect(() => { loadSources(); loadPendingCount(); }, []);

  const handleAddSource = async () => {
    if (!form.name.trim() || !form.url.trim()) { toast.error("Name and URL are required"); return; }
    const { error } = await supabase.from("news_sources").insert({
      name: form.name.trim(),
      url: form.url.trim(),
      category: form.category,
      language: form.language,
      fetch_interval_hours: parseInt(form.fetch_interval_hours) || 24,
      sort_order: sources.length + 1,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Source added");
    setForm({ name: "", url: "", category: "general", language: "ar", fetch_interval_hours: "24" });
    setDialogOpen(false);
    loadSources();
  };

  const toggleSource = async (source: NewsSource) => {
    await supabase.from("news_sources").update({ active: !source.active } as any).eq("id", source.id);
    loadSources();
  };

  const deleteSource = async (id: string) => {
    if (!confirm("Delete this source?")) return;
    await supabase.from("news_sources").delete().eq("id", id);
    toast.success("Deleted");
    loadSources();
  };

  const fetchAllSources = async () => {
    setFetching(true);
    setLastResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("rss-news-aggregator", {
        body: { fetchAll: true },
      });
      if (error) throw error;
      setLastResults(data);
      toast.success(`Fetched ${data.fetched} new articles from ${data.results?.length || 0} sources`);
      loadSources();
      loadPendingCount();
    } catch (e: any) {
      toast.error(e.message || "Fetch failed");
    }
    setFetching(false);
  };

  const fetchSingleSource = async (sourceId: string) => {
    setFetchingSingle(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke("rss-news-aggregator", {
        body: { sourceId },
      });
      if (error) throw error;
      toast.success(`Fetched ${data.fetched} new articles`);
      if (data.errors?.length) toast.warning(data.errors.join(", "));
      loadSources();
      loadPendingCount();
    } catch (e: any) {
      toast.error(e.message || "Fetch failed");
    }
    setFetchingSingle(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rss className="h-6 w-6 text-primary" /> RSS News Aggregator
          </h1>
          <p className="text-sm text-muted-foreground">
            {sources.length} sources configured • {sources.filter(s => s.active).length} active • {pendingCount} pending review
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAllSources} disabled={fetching} className="gap-2">
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {fetching ? "Fetching..." : "Fetch All Now"}
          </Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Source</Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-primary/10 p-3"><Globe className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{sources.filter(s => s.active).length}</p>
              <p className="text-sm text-muted-foreground">Active Sources</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-amber-500/10 p-3"><Clock className="h-5 w-5 text-amber-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-full bg-green-500/10 p-3"><CheckCircle className="h-5 w-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{sources.length}</p>
              <p className="text-sm text-muted-foreground">Total Sources</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last fetch results */}
      {lastResults && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-sm">Last Fetch Results — {lastResults.fetched} new articles</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lastResults.results?.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{r.source}</span>
                <div className="flex gap-2">
                  <Badge variant="outline">{r.found} found</Badge>
                  <Badge>{r.new} new</Badge>
                </div>
              </div>
            ))}
            {lastResults.errors?.length > 0 && (
              <div className="mt-3 space-y-1">
                {lastResults.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {e}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sources list */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Sources ({sources.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({sources.filter(s => s.active).length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({sources.filter(s => !s.active).length})</TabsTrigger>
        </TabsList>

        {["all", "active", "inactive"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {sources
              .filter(s => tab === "all" || (tab === "active" ? s.active : !s.active))
              .map(source => (
                <div key={source.id} className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4">
                  <Switch checked={source.active} onCheckedChange={() => toggleSource(source)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{source.name}</p>
                      <Badge variant="outline" className="text-xs">{source.language.toUpperCase()}</Badge>
                      <Badge variant="secondary" className="text-xs">{source.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{source.url}</p>
                    {source.last_fetched_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last fetched: {new Date(source.last_fetched_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchSingleSource(source.id)}
                      disabled={fetchingSingle === source.id}
                      className="gap-1"
                    >
                      {fetchingSingle === source.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Fetch
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteSource(source.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Source Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add News Source</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Source Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. CNN Arabic" />
            </div>
            <div className="space-y-1.5">
              <Label>RSS Feed URL *</Label>
              <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/rss.xml" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fetch Interval (hours)</Label>
              <Input type="number" value={form.fetch_interval_hours} onChange={e => setForm({ ...form, fetch_interval_hours: e.target.value })} />
            </div>
            <Button onClick={handleAddSource} className="w-full">Add Source</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
