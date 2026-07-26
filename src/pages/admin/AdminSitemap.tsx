import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RefreshCw, Download, Search, Globe, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface SitemapUrl {
  id: string;
  url: string;
  url_type: string;
  content_id: string | null;
  content_type: string | null;
  title: string | null;
  priority: number;
  changefreq: string;
  active: boolean;
  last_modified: string;
  language: string | null;
  updated_at: string;
}

const URL_TYPES = [
  { value: "all", label: "All Types" },
  { value: "static", label: "Static Pages" },
  { value: "movie", label: "Movies" },
  { value: "anime", label: "Anime" },
  { value: "series", label: "Series" },
  { value: "article", label: "Articles" },
];

const CHANGEFREQ_OPTIONS = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
const PRIORITY_OPTIONS = ["0.0", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0"];
const LANGUAGE_FILTER = [
  { value: "all", label: "All Languages" },
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
];

export default function AdminSitemap() {
  const [urls, setUrls] = useState<SitemapUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterLang, setFilterLang] = useState("all");
  const [search, setSearch] = useState("");

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("sitemap_urls").select("*").order("url_type").order("url");
    if (filterType !== "all") query = query.eq("url_type", filterType);
    if (filterLang !== "all") query = query.or(`language.eq.${filterLang},language.eq.all`);
    const { data, error } = await query;
    if (error) toast.error("Failed to fetch sitemap URLs");
    else setUrls(data || []);
    setLoading(false);
  }, [filterType, filterLang]);

  useEffect(() => { fetchUrls(); }, [fetchUrls]);

  const syncContentToSitemap = async () => {
    setSyncing(true);
    try {
      const [movies, anime, series, articles] = await Promise.all([
        supabase.from("movies").select("id, title, updated_at"),
        supabase.from("anime").select("id, title, updated_at"),
        supabase.from("series").select("id, title, updated_at").eq("visible", true),
        supabase.from("articles").select("id, title, updated_at").eq("status", "published"),
      ]);

      const staticPages = [
        { url: "/", title: "Homepage", priority: 1.0, changefreq: "daily", url_type: "static" },
        { url: "/movies", title: "Movies", priority: 0.9, changefreq: "daily", url_type: "static" },
        { url: "/anime", title: "Anime", priority: 0.9, changefreq: "daily", url_type: "static" },
        { url: "/series", title: "Series", priority: 0.9, changefreq: "daily", url_type: "static" },
        { url: "/articles", title: "Articles", priority: 0.8, changefreq: "daily", url_type: "static" },
        { url: "/highlights", title: "Highlights", priority: 0.8, changefreq: "daily", url_type: "static" },
        { url: "/contact", title: "Contact", priority: 0.4, changefreq: "monthly", url_type: "static" },
        { url: "/subscribe", title: "Subscribe", priority: 0.5, changefreq: "monthly", url_type: "static" },
      ];

      const allRows: any[] = [];

      for (const p of staticPages) {
        allRows.push({ ...p, language: "all", last_modified: new Date().toISOString(), active: true });
      }
      for (const m of movies.data || []) {
        allRows.push({ url: `/movies/${m.id}`, url_type: "movie", content_id: m.id, content_type: "movie", title: m.title, priority: 0.8, changefreq: "weekly", language: "all", last_modified: m.updated_at, active: true });
      }
      for (const a of anime.data || []) {
        allRows.push({ url: `/anime/${a.id}`, url_type: "anime", content_id: a.id, content_type: "anime", title: a.title, priority: 0.7, changefreq: "weekly", language: "all", last_modified: a.updated_at, active: true });
      }
      for (const s of series.data || []) {
        allRows.push({ url: `/series/${s.id}`, url_type: "series", content_id: s.id, content_type: "series", title: s.title, priority: 0.7, changefreq: "weekly", language: "all", last_modified: s.updated_at, active: true });
      }
      for (const a of articles.data || []) {
        allRows.push({ url: `/articles/${a.id}`, url_type: "article", content_id: a.id, content_type: "article", title: a.title, priority: 0.6, changefreq: "daily", language: "all", last_modified: a.updated_at, active: true });
      }

      const { error } = await supabase.from("sitemap_urls").upsert(allRows, { onConflict: "url" });
      if (error) throw error;
      toast.success(`Synced ${allRows.length} URLs to sitemap`);
      fetchUrls();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const regenerateSitemap = async () => {
    setRegenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-sitemap");
      if (error) throw error;
      toast.success("Sitemap regenerated successfully");
    } catch (e: any) {
      toast.error(e.message || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const downloadSitemap = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-sitemap`);
      const xml = await res.text();
      const blob = new Blob([xml], { type: "application/xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "sitemap.xml";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error("Failed to download sitemap");
    }
  };

  const updateUrl = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("sitemap_urls").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Update failed");
    else {
      setUrls(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u));
      toast.success("Updated");
    }
  };

  const filtered = urls.filter(u => !search || u.url.toLowerCase().includes(search.toLowerCase()) || (u.title || "").toLowerCase().includes(search.toLowerCase()));

  const stats = {
    total: urls.length,
    active: urls.filter(u => u.active).length,
    inactive: urls.filter(u => !u.active).length,
  };

  const typeBadgeColor = (t: string) => {
    const m: Record<string, string> = { static: "secondary", movie: "default", anime: "destructive", series: "outline", article: "default" };
    return (m[t] || "secondary") as any;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sitemap Manager</h1>
          <p className="text-sm text-muted-foreground">Manage all sitemap URLs, priorities, and visibility</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={syncContentToSitemap} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync Content
          </Button>
          <Button variant="outline" onClick={regenerateSitemap} disabled={regenerating}>
            {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Regenerate
          </Button>
          <Button variant="outline" onClick={downloadSitemap}>
            <Download className="mr-2 h-4 w-4" /> Download XML
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total URLs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{stats.active}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{stats.inactive}</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search URLs or titles..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{URL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterLang} onValueChange={setFilterLang}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGUAGE_FILTER.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No sitemap URLs found. Click "Sync Content" to populate.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Active</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-28">Priority</TableHead>
                  <TableHead className="w-28">Changefreq</TableHead>
                  <TableHead className="w-36">Last Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id} className={!u.active ? "opacity-50" : ""}>
                    <TableCell>
                      <Switch checked={u.active} onCheckedChange={v => updateUrl(u.id, "active", v)} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate font-mono text-xs">{u.url}</div>
                      {u.title && <div className="text-xs text-muted-foreground truncate">{u.title}</div>}
                    </TableCell>
                    <TableCell><Badge variant={typeBadgeColor(u.url_type)}>{u.url_type}</Badge></TableCell>
                    <TableCell>
                      <Select value={String(u.priority)} onValueChange={v => updateUrl(u.id, "priority", parseFloat(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={u.changefreq} onValueChange={v => updateUrl(u.id, "changefreq", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHANGEFREQ_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.last_modified).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
