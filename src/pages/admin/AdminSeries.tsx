import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import { Plus, Pencil, Trash2, Loader2, Bell, Tv, ChevronUp, ChevronDown, Eye, EyeOff, Wand2, X } from "lucide-react";
import { ImageUpload, MultiImageUpload } from "@/components/admin/ImageUpload";
import { AdminSearchBar } from "@/components/admin/AdminSearchBar";
import { Paginator } from "@/components/Paginator";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { pingGoogleSitemap } from "@/lib/pingSitemap";

interface SeriesItem {
  id: string; title: string; description?: string | null; poster_url?: string | null;
  genre?: string[] | null; year?: number | null; rating?: number | null;
  trailer_url?: string | null; trending?: boolean | null; pinned?: boolean | null;
  visible?: boolean; gallery_images?: string[] | null; created_at: string;
}

interface Episode {
  id: string; series_id: string; episode_number: number; title: string;
  description?: string | null; thumbnail_url?: string | null; trailer_url?: string | null;
  watch_servers?: any; download_servers?: any; visible?: boolean;
}

interface Server { name: string; url: string; quality?: string; }

interface LangTranslation { title: string; description: string; content: string; genre: string; }

const SERIES_LANGUAGES = [
  { code: "ar", label: "العربية", dir: "rtl" as const },
  { code: "fr", label: "Français", dir: "ltr" as const },
  { code: "es", label: "Español", dir: "ltr" as const },
  { code: "de", label: "Deutsch", dir: "ltr" as const },
  { code: "pt", label: "Português", dir: "ltr" as const },
  { code: "ja", label: "日本語", dir: "ltr" as const },
];

export default function AdminSeries() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const scrollPosRef = useRef(0);
  const [editing, setEditing] = useState<SeriesItem | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  // Language translations
  const [langTranslations, setLangTranslations] = useState<Record<string, LangTranslation>>({});
  const [extraLanguages, setExtraLanguages] = useState<{ code: string; label: string; dir: "ltr" | "rtl" }[]>([]);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangLabel, setNewLangLabel] = useState("");
  const [aiTranslatingLang, setAiTranslatingLang] = useState<string | null>(null);

  const allLanguages = [...SERIES_LANGUAGES, ...extraLanguages];

  // Episode management
  const [episodesDialogOpen, setEpisodesDialogOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<SeriesItem | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeForm, setEpisodeForm] = useState<Record<string, any>>({});
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [episodeDialogOpen, setEpisodeDialogOpen] = useState(false);
  const [epWatchServers, setEpWatchServers] = useState<Server[]>([]);
  const [epDownloadServers, setEpDownloadServers] = useState<Server[]>([]);
  const [savingEpisode, setSavingEpisode] = useState(false);

  const fetchItems = async () => {
    setSearchLoading(true);
    // Normalize query: trim + collapse extra whitespace (mirrors public search)
    const q = debouncedSearch.trim().replace(/\s+/g, " ");

    if (!q) {
      // No search: direct paginated query on the main table
      const { data, count } = await supabase
        .from("series")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      setItems((data as SeriesItem[]) || []);
      setTotalCount(count || 0);
    } else {
      // ── Smart search: main title + localized titles/content ──
      // Phase 1: collect matching IDs from the main table (title + year)
      const yearMatch = /^\d{4}$/.test(q);
      let mainQuery = supabase.from("series").select("id");
      if (yearMatch) {
        mainQuery = mainQuery.or(`title.ilike.%${q}%,year.eq.${q}`);
      } else {
        mainQuery = mainQuery.ilike("title", `%${q}%`);
      }
      const { data: mainMatches } = await mainQuery;

      // Phase 2: collect matching IDs from content_translations (localized titles/content)
      const { data: transMatches } = await supabase
        .from("content_translations")
        .select("content_id")
        .eq("content_type", "series")
        .or(`title.ilike.%${q}%,content.ilike.%${q}%`);

      // Combine + dedupe IDs
      const idSet = new Set<string>();
      (mainMatches || []).forEach((m: any) => idSet.add(m.id));
      (transMatches || []).forEach((m: any) => idSet.add(m.content_id));
      const allIds = Array.from(idSet);
      const total = allIds.length;

      // Phase 3: paginate the ID list, then fetch full rows for the current page
      const pageIds = allIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      let items: SeriesItem[] = [];
      if (pageIds.length > 0) {
        const { data } = await supabase
          .from("series")
          .select("*")
          .in("id", pageIds)
          .order("created_at", { ascending: false });
        items = (data as SeriesItem[]) || [];
      }

      setItems(items);
      setTotalCount(total);
    }

    setLoading(false);
    setSearchLoading(false);
  };

  useEffect(() => { fetchItems(); }, [debouncedSearch, page]);

  // Reset to page 1 whenever the search query changes
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const loadTranslations = async (itemId: string) => {
    const { data } = await supabase.from("content_translations").select("*").eq("content_id", itemId).eq("content_type", "series");
    const map: Record<string, LangTranslation> = {};
    const foundLangs = new Set<string>();
    (data || []).forEach((t: any) => {
      map[t.language] = { title: t.title || "", description: t.description || "", content: t.content || "", genre: Array.isArray(t.genre) ? t.genre.join(", ") : "" };
      foundLangs.add(t.language);
    });
    setLangTranslations(map);
    const defaultCodes = SERIES_LANGUAGES.map(l => l.code);
    const extras: { code: string; label: string; dir: "ltr" | "rtl" }[] = [];
    foundLangs.forEach(code => { if (!defaultCodes.includes(code)) extras.push({ code, label: code.toUpperCase(), dir: code === "ar" ? "rtl" : "ltr" }); });
    setExtraLanguages(extras);
  };

  const updateLangField = (lang: string, field: keyof LangTranslation, value: string) => {
    setLangTranslations(prev => ({ ...prev, [lang]: { ...(prev[lang] || { title: "", description: "", content: "", genre: "" }), [field]: value } }));
  };

  const handleAITranslate = async (langCode: string) => {
    if (!editing) { toast.error("Save the content first"); return; }
    setAiTranslatingLang(langCode);
    try {
      const { error } = await supabase.functions.invoke("translate-content", {
        body: { contentId: editing.id, contentType: "series", title: form.title || "", description: form.description || "", targetLanguage: langCode, forceTranslate: true },
      });
      if (error) throw error;
      await loadTranslations(editing.id);
      toast.success(`Translated to ${allLanguages.find(l => l.code === langCode)?.label || langCode}`);
    } catch (e: any) { toast.error(e.message || "Translation failed"); }
    setAiTranslatingLang(null);
  };

  const addNewLanguage = () => {
    if (!newLangCode.trim() || !newLangLabel.trim()) { toast.error("Enter language code and name"); return; }
    const code = newLangCode.trim().toLowerCase();
    if (allLanguages.find(l => l.code === code)) { toast.error("Language already exists"); return; }
    setExtraLanguages([...extraLanguages, { code, label: newLangLabel.trim(), dir: code === "ar" ? "rtl" : "ltr" }]);
    setNewLangCode(""); setNewLangLabel("");
  };

  const removeExtraLang = (code: string) => {
    setExtraLanguages(extraLanguages.filter(l => l.code !== code));
    const copy = { ...langTranslations }; delete copy[code]; setLangTranslations(copy);
  };

  const openCreate = () => { scrollPosRef.current = window.scrollY; setEditing(null); setForm({ visible: true }); setLangTranslations({}); setExtraLanguages([]); setDialogOpen(true); };

  const openEdit = async (item: SeriesItem) => {
    scrollPosRef.current = window.scrollY;
    setEditing(item);
    setForm({
      title: item.title, description: item.description || "", genre: (item.genre || []).join(", "),
      year: item.year || "", trailer_url: item.trailer_url || "", poster_url: item.poster_url || "",
      gallery_images: item.gallery_images || [], trending: item.trending || false, pinned: item.pinned || false,
      visible: item.visible !== false,
    });
    await loadTranslations(item.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error(t("admin.titleRequired")); return; }
    setSaving(true);
    const payload: Record<string, any> = {
      title: form.title, description: form.description || null,
      genre: typeof form.genre === "string" ? form.genre.split(",").map((s: string) => s.trim()).filter(Boolean) : form.genre || [],
      year: form.year ? Number(form.year) : null, trailer_url: form.trailer_url || null,
      poster_url: form.poster_url || null, gallery_images: form.gallery_images || [],
      trending: form.trending || false, pinned: form.pinned || false,
      visible: form.visible !== false,
    };

    let savedId: string | null = null;
    if (editing) {
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from("series").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message);
      else {
        toast.success(`${t("admin.series")} ${t("admin.update").toLowerCase()}d`);
        // Optimistic update — mutate local list, keep DOM height intact
        setItems(prev => prev.map(i => i.id === editing.id ? { ...i, ...payload } as SeriesItem : i));
      }
      savedId = editing.id;
    } else {
      payload.created_by = user?.id;
      const { data: inserted, error } = await supabase.from("series").insert(payload as any).select().single();
      if (error) toast.error(error.message);
      else {
        toast.success(`${t("admin.series")} ${t("admin.create").toLowerCase()}d`);
        savedId = inserted?.id || null;
        // Optimistic append — insert created item locally, no re-fetch
        if (inserted) setItems(prev => [inserted as SeriesItem, ...prev]);
        if (notifyUsers && inserted) {
          try {
            await supabase.functions.invoke("notify-new-content", { body: { content_type: "series", content_id: inserted.id, title: inserted.title, description: (inserted as any).description || null, poster_url: (inserted as any).poster_url || null, send_email: sendEmail } });
            toast.success(t("toast.notificationsSent"));
          } catch { toast.error(t("toast.failedNotifications")); }
        }
      }
    }

    // Save language translations
    if (savedId) {
      for (const lang of allLanguages) {
        const tr = langTranslations[lang.code];
        if (tr && (tr.title.trim() || tr.description.trim() || tr.genre.trim())) {
          const genreArr = tr.genre.trim() ? tr.genre.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          await supabase.from("content_translations").upsert(
            { content_id: savedId, content_type: "series", language: lang.code, title: tr.title.trim() || form.title?.trim() || "", description: tr.description.trim() || null, content: null, genre: genreArr.length > 0 ? genreArr : null } as any,
            { onConflict: "content_id,content_type,language" }
          );
        }
      }
    }

    setSaving(false); setDialogOpen(false);
    // List state was updated optimistically above — NO full re-fetch, so the
    // table DOM height stays intact and scroll position is preserved.
    // Exact scroll restore is enforced by the useLayoutEffect below.

    // Notify Google about the sitemap update (fire-and-forget, never blocks UI).
    if (!editing) pingGoogleSitemap();
  };

  const handleDelete = async (id: string) => {
    zarynConfirm({
      title: "Delete Series",
      message: "Are you sure you want to delete this series and all its episodes?",
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: async () => {
        const { error } = await supabase.from("series").delete().eq("id", id);
        if (error) toast.error(error.message);
        else {
          toast.success("Deleted");
          // Optimistic delete — remove from local state, keep scroll & DOM height
          setItems(prev => prev.filter(i => i.id !== id));
          setTotalCount(prev => Math.max(0, prev - 1));
        }
      },
    });
  };

  // HARD scroll freeze: whenever the modal closes, restore the exact scroll
  // position. Radix Dialog (shadcn) applies body overflow:hidden while open and
  // resets scroll during cleanup — this layout effect runs synchronously BEFORE
  // paint and retries until Radix finishes, so our saved position always wins.
  useLayoutEffect(() => {
    if (dialogOpen) return;
    const saved = scrollPosRef.current;
    if (!saved) return;
    const restore = () => window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior });
    restore();
    const raf = requestAnimationFrame(() => restore());
    const timers = [50, 150, 300].map(ms => window.setTimeout(() => restore(), ms));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(t => window.clearTimeout(t));
    };
  }, [dialogOpen]);

  const toggleSeriesVisibility = async (item: SeriesItem) => {
    const newVis = !(item.visible !== false);
    const { error } = await supabase.from("series").update({ visible: newVis }).eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      toast.success(newVis ? "Series visible" : "Series hidden");
      // Optimistic update — keep DOM height intact
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, visible: newVis } as SeriesItem : i));
    }
  };

  // Episode functions
  const openEpisodes = async (item: SeriesItem) => {
    setSelectedSeries(item);
    const { data } = await supabase.from("episodes").select("*").eq("series_id", item.id).order("episode_number", { ascending: true });
    setEpisodes((data as Episode[]) || []);
    setEpisodesDialogOpen(true);
  };

  const refreshEpisodes = async () => {
    if (!selectedSeries) return;
    const { data } = await supabase.from("episodes").select("*").eq("series_id", selectedSeries.id).order("episode_number", { ascending: true });
    setEpisodes((data as Episode[]) || []);
  };

  const openCreateEpisode = () => {
    setEditingEpisode(null);
    const nextNum = episodes.length > 0 ? Math.max(...episodes.map(e => e.episode_number)) + 1 : 1;
    setEpisodeForm({ episode_number: nextNum, title: "", description: "", thumbnail_url: "", trailer_url: "", visible: true });
    setEpWatchServers([]); setEpDownloadServers([]);
    setEpisodeDialogOpen(true);
  };

  const openEditEpisode = (ep: Episode) => {
    setEditingEpisode(ep);
    setEpisodeForm({
      episode_number: ep.episode_number, title: ep.title, description: ep.description || "",
      thumbnail_url: ep.thumbnail_url || "", trailer_url: ep.trailer_url || "",
      visible: ep.visible !== false,
    });
    setEpWatchServers(Array.isArray(ep.watch_servers) ? ep.watch_servers : []);
    setEpDownloadServers(Array.isArray(ep.download_servers) ? ep.download_servers : []);
    setEpisodeDialogOpen(true);
  };

  const handleSaveEpisode = async () => {
    if (!episodeForm.title?.trim() || !selectedSeries) { toast.error(t("admin.titleRequired")); return; }
    setSavingEpisode(true);
    const payload: Record<string, any> = {
      series_id: selectedSeries.id, episode_number: Number(episodeForm.episode_number) || 1,
      title: episodeForm.title, description: episodeForm.description || null,
      thumbnail_url: episodeForm.thumbnail_url || null, trailer_url: episodeForm.trailer_url || null,
      watch_servers: epWatchServers, download_servers: epDownloadServers,
      visible: episodeForm.visible !== false,
    };

    if (editingEpisode) {
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from("episodes").update(payload).eq("id", editingEpisode.id);
      if (error) toast.error(error.message); else toast.success("Episode updated");
    } else {
      const { error } = await supabase.from("episodes").insert(payload as any);
      if (error) toast.error(error.message); else toast.success("Episode created");
    }
    setSavingEpisode(false); setEpisodeDialogOpen(false);
    refreshEpisodes();
  };

  const handleDeleteEpisode = async (epId: string) => {
    zarynConfirm({
      title: "Delete Episode",
      message: "Are you sure you want to delete this episode?",
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: async () => {
        const { error } = await supabase.from("episodes").delete().eq("id", epId);
        if (error) toast.error(error.message); else { toast.success("Episode deleted"); refreshEpisodes(); }
      },
    });
  };

  const toggleEpisodeVisibility = async (ep: Episode) => {
    const newVis = !(ep.visible !== false);
    const { error } = await supabase.from("episodes").update({ visible: newVis }).eq("id", ep.id);
    if (error) toast.error(error.message);
    else { toast.success(newVis ? "Episode visible" : "Episode hidden"); refreshEpisodes(); }
  };

  const moveEpisode = async (ep: Episode, direction: "up" | "down") => {
    const idx = episodes.findIndex(e => e.id === ep.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= episodes.length) return;
    const other = episodes[swapIdx];
    // Swap episode numbers
    await Promise.all([
      supabase.from("episodes").update({ episode_number: other.episode_number }).eq("id", ep.id),
      supabase.from("episodes").update({ episode_number: ep.episode_number }).eq("id", other.id),
    ]);
    refreshEpisodes();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">{t("admin.series")}</h1>
          <p className="text-muted-foreground mt-1">{items.length} {t("admin.items")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          // Exact scroll restore is enforced by the useLayoutEffect below.
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-brand text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> {t("admin.addNew")} {t("admin.series")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{editing ? t("admin.edit") : t("admin.addNew")} {t("admin.series")}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="main" className="flex-1 min-w-[70px]">Main</TabsTrigger>
                {allLanguages.map(lang => (
                  <TabsTrigger key={lang.code} value={`lang-${lang.code}`} className="flex-1 min-w-[70px]">{lang.label}</TabsTrigger>
                ))}
                <TabsTrigger value="add-lang" className="min-w-[40px]"><Plus className="h-3 w-3" /></TabsTrigger>
                <TabsTrigger value="media" className="flex-1 min-w-[80px]">Media</TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-4 pt-2">
                {["title", "description", "year", "trailer_url"].map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="capitalize text-foreground">{field.replace(/_/g, " ")}</Label>
                    {field === "description" ? (
                      <Textarea value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="border-border/50 bg-background/50" rows={3} />
                    ) : (
                      <Input value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="border-border/50 bg-background/50" type={field === "year" ? "number" : "text"} placeholder={field === "trailer_url" ? "YouTube URL or direct video link" : ""} />
                    )}
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-foreground">Genre (Main / English)</Label>
                  <Input value={form.genre || ""} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="border-border/50 bg-background/50" placeholder="Action, Drama, Comedy" />
                </div>
                <div className="flex gap-6 flex-wrap">
                  <div className="flex items-center gap-2"><Switch checked={form.trending || false} onCheckedChange={(v) => setForm({ ...form, trending: v })} /><Label className="text-foreground">{t("admin.trending")}</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.pinned || false} onCheckedChange={(v) => setForm({ ...form, pinned: v })} /><Label className="text-foreground">{t("admin.pinned")}</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.visible !== false} onCheckedChange={(v) => setForm({ ...form, visible: v })} /><Label className="text-foreground">{t("series.visible")}</Label></div>
                </div>
              </TabsContent>

              {allLanguages.map(lang => {
                const tr = langTranslations[lang.code] || { title: "", description: "", content: "", genre: "" };
                const isExtra = extraLanguages.find(l => l.code === lang.code);
                return (
                  <TabsContent key={lang.code} value={`lang-${lang.code}`} className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{lang.label} — {lang.dir === "rtl" ? "RTL" : "LTR"}</p>
                      <div className="flex gap-2">
                        {editing && (
                          <Button size="sm" variant="outline" onClick={() => handleAITranslate(lang.code)} disabled={aiTranslatingLang === lang.code} className="gap-1">
                            {aiTranslatingLang === lang.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} AI Translate
                          </Button>
                        )}
                        {isExtra && <Button size="sm" variant="ghost" onClick={() => removeExtraLang(lang.code)}><X className="h-3 w-3" /></Button>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input value={tr.title} onChange={(e) => updateLangField(lang.code, "title", e.target.value)} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} placeholder="Leave empty to keep original" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Textarea value={tr.description} onChange={(e) => updateLangField(lang.code, "description", e.target.value)} rows={6} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Genre / Keywords</Label>
                      <Input value={tr.genre} onChange={(e) => updateLangField(lang.code, "genre", e.target.value)} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} placeholder="Action, Drama, Comedy" />
                      <p className="text-xs text-muted-foreground">Comma-separated localized genre keywords for {lang.label}</p>
                    </div>
                  </TabsContent>
                );
              })}

              <TabsContent value="add-lang" className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">Add a new language for this content.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Language Code</Label><Input value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder="e.g. ko, hi" maxLength={5} /></div>
                  <div className="space-y-1.5"><Label>Language Name</Label><Input value={newLangLabel} onChange={(e) => setNewLangLabel(e.target.value)} placeholder="e.g. 한국어, हिन्दी" /></div>
                </div>
                <Button onClick={addNewLanguage} variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add Language</Button>
                {extraLanguages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {extraLanguages.map(l => (
                      <span key={l.code} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        {l.label} ({l.code}) <button onClick={() => removeExtraLang(l.code)}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="media" className="space-y-4 pt-2">
                <ImageUpload bucket="content" folder="series" value={form.poster_url || ""} onChange={(url) => setForm({ ...form, poster_url: url })} label="Poster Image" />
                <MultiImageUpload bucket="content" folder="series/gallery" value={form.gallery_images || []} onChange={(urls) => setForm({ ...form, gallery_images: urls })} label="Gallery Images" max={10} />
              </TabsContent>
            </Tabs>

            <div className="space-y-4 pt-2">
              {!editing && (
                <div className="rounded-xl border border-border/30 bg-background/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Bell className="h-4 w-4 text-primary" /> {t("admin.notifyUsers")}</div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="notify-series" checked={notifyUsers} onCheckedChange={(v) => setNotifyUsers(!!v)} />
                    <label htmlFor="notify-series" className="text-sm text-muted-foreground cursor-pointer">{t("admin.sendInApp")}</label>
                  </div>
                  {notifyUsers && (
                    <div className="flex items-center gap-2 ml-6">
                      <Checkbox id="email-series" checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
                      <label htmlFor="email-series" className="text-sm text-muted-foreground cursor-pointer">{t("admin.sendEmail")}</label>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full gradient-brand text-primary-foreground">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? t("admin.update") : t("admin.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/50">
            <AdminSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search series by title, year, or ID..."
              totalCount={totalCount}
              filteredCount={items.length}
              loading={searchLoading}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">{t("admin.image")}</TableHead>
                <TableHead className="text-muted-foreground">Title</TableHead>
                <TableHead className="text-muted-foreground">{t("admin.year")}</TableHead>
                <TableHead className="text-muted-foreground">{t("admin.status")}</TableHead>
                <TableHead className="text-muted-foreground">{t("series.episodes")}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-border/50">
                  <TableCell>{item.poster_url ? <img src={item.poster_url} alt={item.title} className="h-12 w-9 rounded object-cover" /> : <div className="h-12 w-9 rounded bg-muted" />}</TableCell>
                  <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                  <TableCell className="text-muted-foreground">{item.year || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={item.visible !== false ? "default" : "outline"} className={item.visible !== false ? "bg-primary/20 text-primary border-primary/30" : "text-muted-foreground"}>
                      {item.visible !== false ? t("series.visible") : t("series.hidden")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openEpisodes(item)} className="gap-1">
                      <Tv className="h-3 w-3" /> {t("series.manageEpisodes")}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toggleSeriesVisibility(item)} title={item.visible !== false ? "Hide" : "Show"}>
                        {item.visible !== false ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchQuery.trim() ? `No results found for "${searchQuery}"` : t("admin.noItems")}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {totalCount > PAGE_SIZE && (
            <div className="border-t border-border/50 px-4">
              <Paginator
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Episodes Management Dialog */}
      <Dialog open={episodesDialogOpen} onOpenChange={setEpisodesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{t("series.episodes")} — {selectedSeries?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={openCreateEpisode} className="gradient-brand text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> {t("series.addEpisode")}
            </Button>

            {episodes.length > 0 ? (
              <div className="space-y-2">
                {episodes.map((ep, idx) => (
                  <div key={ep.id} className={`flex items-center gap-3 rounded-lg border p-3 ${ep.visible !== false ? "border-border/50 bg-background/50" : "border-border/30 bg-background/20 opacity-60"}`}>
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveEpisode(ep, "up")}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === episodes.length - 1} onClick={() => moveEpisode(ep, "down")}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    {ep.thumbnail_url && <img src={ep.thumbnail_url} alt={ep.title} className="h-12 w-20 rounded object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary font-medium">EP {ep.episode_number}</span>
                        {ep.visible === false && <Badge variant="outline" className="text-[10px] text-muted-foreground">{t("series.hidden")}</Badge>}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{ep.title}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => toggleEpisodeVisibility(ep)} title={ep.visible !== false ? "Hide" : "Show"}>
                        {ep.visible !== false ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditEpisode(ep)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteEpisode(ep.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">{t("series.noEpisodes")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Episode Create/Edit Dialog */}
      <Dialog open={episodeDialogOpen} onOpenChange={setEpisodeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editingEpisode ? t("admin.edit") : t("admin.addNew")} {t("series.episode")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <ImageUpload bucket="content" folder="series/episodes" value={episodeForm.thumbnail_url || ""} onChange={(url) => setEpisodeForm({ ...episodeForm, thumbnail_url: url })} label="Episode Thumbnail" />

            <div className="space-y-1.5">
              <Label className="text-foreground">{t("series.episodeNumber")}</Label>
              <Input type="number" value={episodeForm.episode_number || ""} onChange={(e) => setEpisodeForm({ ...episodeForm, episode_number: e.target.value })} className="border-border/50 bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Title</Label>
              <Input value={episodeForm.title || ""} onChange={(e) => setEpisodeForm({ ...episodeForm, title: e.target.value })} className="border-border/50 bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Description</Label>
              <Textarea value={episodeForm.description || ""} onChange={(e) => setEpisodeForm({ ...episodeForm, description: e.target.value })} className="border-border/50 bg-background/50" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Trailer URL</Label>
              <Input value={episodeForm.trailer_url || ""} onChange={(e) => setEpisodeForm({ ...episodeForm, trailer_url: e.target.value })} className="border-border/50 bg-background/50" placeholder="YouTube URL or direct video link" />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={episodeForm.visible !== false} onCheckedChange={(v) => setEpisodeForm({ ...episodeForm, visible: v })} />
              <Label className="text-foreground">{t("series.visible")}</Label>
            </div>

            <ServerEditor label={t("servers.watchServers")} servers={epWatchServers} setServers={setEpWatchServers} />
            <ServerEditor label={t("servers.downloadServers")} servers={epDownloadServers} setServers={setEpDownloadServers} />

            <Button onClick={handleSaveEpisode} disabled={savingEpisode} className="w-full gradient-brand text-primary-foreground">
              {savingEpisode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingEpisode ? t("admin.update") : t("admin.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServerEditor({ label, servers, setServers }: { label: string; servers: Server[]; setServers: (s: Server[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setServers([...servers, { name: "", url: "", quality: "" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {servers.map((server, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Input placeholder="Server name" value={server.name} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], name: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 flex-1" />
          <Input placeholder="URL" value={server.url} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], url: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 flex-1" />
          <Input placeholder="Quality" value={server.quality || ""} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], quality: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 w-24" />
          <Button variant="ghost" size="icon" onClick={() => setServers(servers.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}
