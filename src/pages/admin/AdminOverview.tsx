import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Film, Tv, FileText, Image, Users, MessageSquare, Eye, Download,
  TrendingUp, Calendar, BarChart3, Search, ArrowUpDown, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";

interface ContentStats { movies: number; anime: number; series: number; articles: number; backgrounds: number; users: number; comments: number; }
interface ViewRow { content_type: string; content_id: string; created_at: string; }
interface DownloadRow { content_type: string; content_id: string; download_link: string; created_at: string; }
interface ContentItem { id: string; title: string; poster_url?: string | null; cover_url?: string | null; }

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(220 70% 50%)", "hsl(340 65% 50%)"];

export default function AdminOverview() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<ContentStats>({ movies: 0, anime: 0, series: 0, articles: 0, backgrounds: 0, users: 0, comments: 0 });
  const [views, setViews] = useState<ViewRow[]>([]);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [contentMap, setContentMap] = useState<Record<string, ContentItem>>({});
  const [dateRange, setDateRange] = useState("30");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"views" | "downloads">("views");
  const [filterType, setFilterType] = useState("all");
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    const since = subDays(new Date(), parseInt(dateRange)).toISOString();

    const [m, a, s, ar, b, u, c, vRes, dRes] = await Promise.all([
      supabase.from("movies").select("id", { count: "exact", head: true }),
      supabase.from("anime").select("id", { count: "exact", head: true }),
      supabase.from("series").select("id", { count: "exact", head: true }),
      supabase.from("articles").select("id", { count: "exact", head: true }),
      supabase.from("highlights").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("comments").select("id", { count: "exact", head: true }),
      supabase.from("content_views").select("content_type, content_id, created_at").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("content_downloads").select("content_type, content_id, download_link, created_at").gte("created_at", since).order("created_at", { ascending: false }),
    ]);

    setStats({
      movies: m.count ?? 0, anime: a.count ?? 0, series: s.count ?? 0,
      articles: ar.count ?? 0, backgrounds: b.count ?? 0, users: u.count ?? 0, comments: c.count ?? 0,
    });
    setViews((vRes.data || []) as ViewRow[]);
    setDownloads((dRes.data || []) as DownloadRow[]);

    const [movies, animes, seriesData, articles] = await Promise.all([
      supabase.from("movies").select("id, title, poster_url"),
      supabase.from("anime").select("id, title, poster_url"),
      supabase.from("series").select("id, title, poster_url"),
      supabase.from("articles").select("id, title, cover_url"),
    ]);

    const map: Record<string, ContentItem> = {};
    [...(movies.data || []), ...(animes.data || []), ...(seriesData.data || []), ...(articles.data || [])].forEach((item: any) => {
      map[item.id] = item;
    });
    setContentMap(map);
    setLastSync(new Date());
  }, [dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Real-time sync via centralized manager
  useEffect(() => {
    const unsub = realtimeManager.subscribe("admin-overview", {
      tables: [
        { schema: "public", table: "movies" },
        { schema: "public", table: "anime" },
        { schema: "public", table: "series" },
        { schema: "public", table: "articles" },
        { schema: "public", table: "advertisements" },
        { schema: "public", table: "profiles" },
        { schema: "public", table: "comments" },
      ],
      onChange: () => fetchAll(),
      debounceMs: 500,
    });
    return () => { unsub(); };
  }, [fetchAll]);

  const todayViews = useMemo(() => {
    const today = startOfDay(new Date()).toISOString();
    return views.filter(v => v.created_at >= today).length;
  }, [views]);

  const monthViews = useMemo(() => {
    const monthStart = startOfMonth(new Date()).toISOString();
    return views.filter(v => v.created_at >= monthStart).length;
  }, [views]);

  const totalDownloads = downloads.length;

  const dailyData = useMemo(() => {
    const days = parseInt(dateRange);
    const data: { date: string; views: number; downloads: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = format(day, "yyyy-MM-dd");
      const label = format(day, "MM/dd");
      data.push({
        date: label,
        views: views.filter(v => v.created_at.startsWith(dayStr)).length,
        downloads: downloads.filter(d => d.created_at.startsWith(dayStr)).length,
      });
    }
    return data;
  }, [views, downloads, dateRange]);

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    views.forEach(v => { counts[v.content_type] = (counts[v.content_type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [views]);

  const topContent = useMemo(() => {
    const viewCounts: Record<string, { type: string; count: number }> = {};
    views.forEach(v => {
      if (!viewCounts[v.content_id]) viewCounts[v.content_id] = { type: v.content_type, count: 0 };
      viewCounts[v.content_id].count++;
    });
    const dlCounts: Record<string, number> = {};
    downloads.forEach(d => { dlCounts[d.content_id] = (dlCounts[d.content_id] || 0) + 1; });

    return Object.entries(viewCounts)
      .map(([id, { type, count }]) => ({
        id, type,
        title: contentMap[id]?.title || id.substring(0, 8),
        poster: contentMap[id]?.poster_url || contentMap[id]?.cover_url,
        views: count,
        downloads: dlCounts[id] || 0,
      }))
      .filter(item => filterType === "all" || item.type === filterType)
      .filter(item => !searchTerm || item.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => sortBy === "views" ? b.views - a.views : b.downloads - a.downloads)
      .slice(0, 20);
  }, [views, downloads, contentMap, filterType, searchTerm, sortBy]);

  const barData = topContent.slice(0, 10).map(c => ({
    name: c.title.length > 15 ? c.title.substring(0, 15) + "…" : c.title,
    views: c.views,
    downloads: c.downloads,
  }));

  const downloadLinks = useMemo(() => {
    const linkCounts: Record<string, { link: string; contentId: string; type: string; count: number }> = {};
    downloads.forEach(d => {
      const key = `${d.content_id}_${d.download_link}`;
      if (!linkCounts[key]) linkCounts[key] = { link: d.download_link, contentId: d.content_id, type: d.content_type, count: 0 };
      linkCounts[key].count++;
    });
    return Object.values(linkCounts).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [downloads]);

  const exportCSV = () => {
    const headers = "Title,Type,Views,Downloads\n";
    const rows = topContent.map(c => `"${c.title}",${c.type},${c.views},${c.downloads}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summaryCards = [
    { label: t("admin.movies"), value: stats.movies, icon: Film, color: "text-primary" },
    { label: t("admin.anime"), value: stats.anime, icon: Tv, color: "text-secondary" },
    { label: t("admin.series"), value: stats.series, icon: Tv, color: "text-primary" },
    { label: t("admin.articles"), value: stats.articles, icon: FileText, color: "text-accent" },
    { label: t("admin.users"), value: stats.users, icon: Users, color: "text-secondary" },
    { label: t("admin.comments"), value: stats.comments, icon: MessageSquare, color: "text-accent" },
    { label: "Total Views", value: views.length, icon: Eye, color: "text-primary" },
    { label: "Today Views", value: todayViews, icon: Calendar, color: "text-secondary" },
    { label: "Month Views", value: monthViews, icon: TrendingUp, color: "text-accent" },
    { label: "Downloads", value: totalDownloads, icon: Download, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">{t("admin.dashboard")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.platformOverview")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Synced: {format(lastSync, "HH:mm:ss")}
          </span>
          <Button variant="ghost" size="icon" onClick={fetchAll} title="Refresh now">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((c) => (
          <Card key={c.label} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-foreground">{c.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Views & Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Legend />
                <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="downloads" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Views by Content Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={typeDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {typeDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top 10 Most Viewed Content</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                <Legend />
                <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="downloads" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Content Analytics Table */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content Analytics</TabsTrigger>
          <TabsTrigger value="downloads">Download Links</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-sm font-medium">Content Performance</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-8 w-[180px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="anime">Anime</SelectItem>
                      <SelectItem value="series">Series</SelectItem>
                      <SelectItem value="article">Articles</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => setSortBy(s => s === "views" ? "downloads" : "views")}>
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Downloads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topContent.map((item, i) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.poster && (
                              <img src={item.poster} alt="" className="h-8 w-6 rounded object-cover" />
                            )}
                            <span className="font-medium text-foreground truncate max-w-[200px]">{item.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">{item.type}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.views.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{item.downloads.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {topContent.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data for this period</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="downloads">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Most Used Download Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead className="text-right">Uses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloadLinks.map((dl, i) => (
                      <TableRow key={`${dl.contentId}_${dl.link}_${i}`}>
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <span className="font-medium text-foreground truncate max-w-[150px]">
                            {contentMap[dl.contentId]?.title || dl.contentId.substring(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <a href={dl.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px] block">
                            {dl.link}
                          </a>
                        </TableCell>
                        <TableCell className="text-right font-medium">{dl.count}</TableCell>
                      </TableRow>
                    ))}
                    {downloadLinks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No download data</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
