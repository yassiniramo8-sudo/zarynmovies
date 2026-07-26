import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Sparkles, Loader2, Wand2, Languages, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ImageUpload } from "@/components/admin/ImageUpload";

interface NewsItem {
  id: string;
  title: string;
  title_ar: string | null;
  content: string | null;
  content_ar: string | null;
  excerpt: string | null;
  excerpt_ar: string | null;
  image_url: string | null;
  video_url: string | null;
  source_url: string | null;
  source_name: string | null;
  category: string | null;
  tags: string[];
  status: string;
  ai_generated: boolean | null;
  published_at: string | null;
  created_at: string;
}

const CATEGORIES = [
  "Politics", "Sports", "Technology", "Economy", "Entertainment",
  "Science", "Health", "International", "National", "Culture",
  "Breaking News", "Opinion", "Environment", "Education", "Business", "General",
];

export default function AdminSportsNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [publishAllOpen, setPublishAllOpen] = useState(false);
  const [publishCount, setPublishCount] = useState(10);
  const [publishLoading, setPublishLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLanguage, setAiLanguage] = useState("auto");
  const [aiCountry, setAiCountry] = useState("global");
  const [aiNewsType, setAiNewsType] = useState("daily");
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: "", title_ar: "", content: "", content_ar: "",
    excerpt: "", excerpt_ar: "", image_url: "", video_url: "",
    source_url: "", source_name: "", category: "General",
    tags: "", status: "draft",
    // Spanish & French (stored in news_translations)
    title_fr: "", excerpt_fr: "", content_fr: "",
    title_es: "", excerpt_es: "", content_es: "",
  });
  // Extra languages support
  const [extraLangs, setExtraLangs] = useState<{ code: string; label: string; dir: "ltr" | "rtl" }[]>([]);
  const [extraLangData, setExtraLangData] = useState<Record<string, { title: string; excerpt: string; content: string }>>({});
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangLabel, setNewLangLabel] = useState("");
  const [aiTranslatingLang, setAiTranslatingLang] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase.from("sports_news").select("*").order("created_at", { ascending: false });
    setItems((data as any[]) || []);
  };

  useEffect(() => { fetchItems(); }, []);

  const resetForm = () => { setForm({ title: "", title_ar: "", content: "", content_ar: "", excerpt: "", excerpt_ar: "", image_url: "", video_url: "", source_url: "", source_name: "", category: "General", tags: "", status: "draft", title_fr: "", excerpt_fr: "", content_fr: "", title_es: "", excerpt_es: "", content_es: "" }); setExtraLangs([]); setExtraLangData({}); };

  const openNew = () => { setEditing(null); resetForm(); setDialogOpen(true); };

  const openEdit = async (n: NewsItem) => {
    setEditing(n);
    // Load all translations from news_translations
    let title_fr = "", excerpt_fr = "", content_fr = "";
    let title_es = "", excerpt_es = "", content_es = "";
    const extraData: Record<string, { title: string; excerpt: string; content: string }> = {};
    const extras: { code: string; label: string; dir: "ltr" | "rtl" }[] = [];
    const { data: trans } = await supabase
      .from("news_translations")
      .select("language, title, excerpt, content")
      .eq("news_id", n.id);
    trans?.forEach((t: any) => {
      if (t.language === "fr") { title_fr = t.title || ""; excerpt_fr = t.excerpt || ""; content_fr = t.content || ""; }
      else if (t.language === "es") { title_es = t.title || ""; excerpt_es = t.excerpt || ""; content_es = t.content || ""; }
      else if (t.language !== "ar" && t.language !== "en") {
        extraData[t.language] = { title: t.title || "", excerpt: t.excerpt || "", content: t.content || "" };
        extras.push({ code: t.language, label: t.language.toUpperCase(), dir: t.language === "ar" ? "rtl" : "ltr" });
      }
    });
    setExtraLangs(extras);
    setExtraLangData(extraData);
    setForm({
      title: n.title, title_ar: n.title_ar || "", content: n.content || "", content_ar: n.content_ar || "",
      excerpt: n.excerpt || "", excerpt_ar: n.excerpt_ar || "", image_url: n.image_url || "",
      video_url: n.video_url || "", source_url: n.source_url || "", source_name: n.source_name || "",
      category: n.category || "General", tags: n.tags?.join(", ") || "", status: n.status,
      title_fr, excerpt_fr, content_fr, title_es, excerpt_es, content_es,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setLoading(true);
    const payload = {
      title: form.title.trim(), title_ar: form.title_ar.trim() || null,
      content: form.content.trim() || null, content_ar: form.content_ar.trim() || null,
      excerpt: form.excerpt.trim() || null, excerpt_ar: form.excerpt_ar.trim() || null,
      image_url: form.image_url || null, video_url: form.video_url || null,
      source_url: form.source_url || null, source_name: form.source_name || null,
      category: form.category, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      status: form.status, updated_at: new Date().toISOString(),
      published_at: form.status === "published" ? new Date().toISOString() : null,
    };

    let newsId: string;
    if (editing) {
      await supabase.from("sports_news").update(payload).eq("id", editing.id);
      newsId = editing.id;
      toast.success("Updated");
    } else {
      const { data: inserted } = await supabase.from("sports_news").insert({ ...payload, created_by: user?.id }).select("id").single();
      newsId = inserted?.id || "";
      toast.success("Created");
    }

    // Save French & Spanish translations to news_translations
    if (newsId) {
      for (const lang of ["fr", "es"] as const) {
        const t = lang === "fr"
          ? { title: form.title_fr.trim(), excerpt: form.excerpt_fr.trim() || null, content: form.content_fr.trim() || null }
          : { title: form.title_es.trim(), excerpt: form.excerpt_es.trim() || null, content: form.content_es.trim() || null };
        if (t.title) {
          await supabase.from("news_translations").upsert(
            { news_id: newsId, language: lang, title: t.title, excerpt: t.excerpt, content: t.content },
            { onConflict: "news_id,language" }
          );
        }
      }
      // Save extra language translations
      for (const lang of extraLangs) {
        const d = extraLangData[lang.code];
        if (d && d.title.trim()) {
          await supabase.from("news_translations").upsert(
            { news_id: newsId, language: lang.code, title: d.title.trim(), excerpt: d.excerpt.trim() || null, content: d.content.trim() || null },
            { onConflict: "news_id,language" }
          );
        }
      }
    }

    setDialogOpen(false);
    setLoading(false);
    fetchItems();
  };

  const handleAITranslateLang = async (langCode: string) => {
    if (!editing) { toast.error("Save the article first"); return; }
    setAiTranslatingLang(langCode);
    try {
      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: {
          contentId: editing.id,
          contentType: "sports_news",
          title: form.title,
          description: form.content || form.excerpt || "",
          targetLanguage: langCode,
          forceTranslate: true,
        },
      });
      if (error) throw error;
      // Reload the translation
      const { data: t2 } = await supabase
        .from("news_translations")
        .select("title, excerpt, content")
        .eq("news_id", editing.id)
        .eq("language", langCode)
        .single();
      if (t2) {
        if (langCode === "fr") setForm(f => ({ ...f, title_fr: t2.title || "", excerpt_fr: t2.excerpt || "", content_fr: t2.content || "" }));
        else if (langCode === "es") setForm(f => ({ ...f, title_es: t2.title || "", excerpt_es: t2.excerpt || "", content_es: t2.content || "" }));
        else setExtraLangData(prev => ({ ...prev, [langCode]: { title: t2.title || "", excerpt: t2.excerpt || "", content: t2.content || "" } }));
      }
      toast.success(`Translated to ${langCode.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    }
    setAiTranslatingLang(null);
  };

  const addNewLang = () => {
    if (!newLangCode.trim() || !newLangLabel.trim()) { toast.error("Enter code and name"); return; }
    const code = newLangCode.trim().toLowerCase();
    const allCodes = ["en", "ar", "fr", "es", ...extraLangs.map(l => l.code)];
    if (allCodes.includes(code)) { toast.error("Language already exists"); return; }
    setExtraLangs([...extraLangs, { code, label: newLangLabel.trim(), dir: code === "ar" ? "rtl" : "ltr" }]);
    setExtraLangData(prev => ({ ...prev, [code]: { title: "", excerpt: "", content: "" } }));
    setNewLangCode("");
    setNewLangLabel("");
  };

  const removeExtraLang = (code: string) => {
    setExtraLangs(extraLangs.filter(l => l.code !== code));
    const copy = { ...extraLangData };
    delete copy[code];
    setExtraLangData(copy);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await supabase.from("sports_news").delete().eq("id", id);
    toast.success("Deleted");
    fetchItems();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(n => n.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected articles?`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    await supabase.from("sports_news").delete().in("id", ids);
    toast.success(`Deleted ${ids.length} articles`);
    setSelectedIds(new Set());
    setBulkDeleting(false);
    fetchItems();
  };

  const toggleStatus = async (n: NewsItem) => {
    const s = n.status === "published" ? "draft" : "published";
    await supabase.from("sports_news").update({ status: s, published_at: s === "published" ? new Date().toISOString() : null }).eq("id", n.id);
    fetchItems();
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) { toast.error("Enter a topic or headline"); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-news-generator", {
        body: {
          topic: aiTopic,
          language: aiLanguage === "auto" ? undefined : aiLanguage,
          country: aiCountry,
          newsType: aiNewsType,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setAiLoading(false); return; }

      const r = data.result;
      setForm({
        title: r.title || "", title_ar: r.title_ar || "",
        content: r.content || "", content_ar: r.content_ar || "",
        excerpt: r.excerpt || "", excerpt_ar: r.excerpt_ar || "",
        image_url: "", video_url: "",
        source_url: "", source_name: r.source_name || "AI Generated",
        category: r.category || "General",
        tags: (r.tags || []).join(", "),
        status: "draft",
        title_fr: "", excerpt_fr: "", content_fr: "",
        title_es: "", excerpt_es: "", content_es: "",
      });
      setEditing(null);
      setAiDialogOpen(false);
      setDialogOpen(true);
      toast.success("AI content generated! Review and publish.");
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    }
    setAiLoading(false);
  };

  const handleTranslateAll = async () => {
    setTranslateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-news", {
        body: { translateAll: true },
      });
      if (error) throw error;
      toast.success(`Translated ${data.translated} entries across ${data.articles} articles into AR/EN/FR/ES`);
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    }
    setTranslateLoading(false);
  };

  const handleTranslateSingle = async (newsId: string) => {
    setTranslatingId(newsId);
    try {
      const { data, error } = await supabase.functions.invoke("translate-news", {
        body: { newsIds: [newsId] },
      });
      if (error) throw error;
      toast.success(`Translated to ${data.translated} languages`);
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    }
    setTranslatingId(null);
  };

  const handlePublishAll = async () => {
    setPublishLoading(true);
    try {
      const draftItems = items.filter(n => n.status === "draft").slice(0, publishCount);
      if (draftItems.length === 0) {
        toast.error("No draft articles to publish");
        setPublishLoading(false);
        return;
      }
      const ids = draftItems.map(n => n.id);
      const { error } = await supabase
        .from("sports_news")
        .update({ status: "published", published_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Published ${draftItems.length} articles`);
      setPublishAllOpen(false);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message || "Publish failed");
    }
    setPublishLoading(false);
  };

  const filtered = items.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || n.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const usedCategories = Array.from(new Set(items.map(n => n.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News Manager</h1>
          <p className="text-sm text-muted-foreground">{items.length} articles • AI-powered & manual • All categories</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setPublishAllOpen(true)} className="gap-2">
            <Send className="h-4 w-4 text-green-500" /> Publish All
          </Button>
          <Button variant="outline" onClick={handleTranslateAll} disabled={translateLoading} className="gap-2">
            {translateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4 text-blue-500" />}
            {translateLoading ? "Translating..." : "Translate All"}
          </Button>
          <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> AI Generate
          </Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add Manually</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Search news..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {usedCategories.map(c => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting} className="gap-2">
            {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete {selectedIds.size} Selected
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-2">
          {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((n) => (
          <div key={n.id} className={`flex items-center gap-4 rounded-lg border p-3 ${selectedIds.has(n.id) ? "border-primary bg-primary/5" : "border-border/50 bg-card"}`}>
            <input type="checkbox" checked={selectedIds.has(n.id)} onChange={() => toggleSelect(n.id)} className="h-4 w-4 rounded border-border accent-primary flex-shrink-0" />
            {n.image_url && <img src={n.image_url} alt="" className="h-16 w-24 rounded-md object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{n.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={n.status === "published" ? "default" : "secondary"}>{n.status}</Badge>
                {n.category && <Badge variant="outline">{n.category}</Badge>}
                {n.ai_generated && <Badge variant="outline" className="text-amber-500 border-amber-500/30"><Sparkles className="mr-1 h-3 w-3" />AI</Badge>}
                {n.source_name && <span className="text-xs text-muted-foreground">{n.source_name}</span>}
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button size="icon" variant="ghost" onClick={() => handleTranslateSingle(n.id)} disabled={translatingId === n.id} title="Translate">
                {translatingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4 text-blue-500" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => toggleStatus(n)}>
                {n.status === "published" ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground">No news yet. Use AI Generate or Add Manually.</p>}
      </div>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> AI News Generator</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter any news topic, headline, or keyword in any language. AI will search the internet and generate a complete SEO-optimized article with translations. Supports all categories: politics, sports, tech, economy, entertainment, and more.</p>
            <div className="space-y-1.5">
              <Label>Topic / Headline / Keyword</Label>
              <Textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="e.g. Latest AI regulations in the EU, أخبار الانتخابات, Tesla stock price surge"
                rows={3}
              />
            </div>
             <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={aiLanguage} onValueChange={setAiLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Country / Region</Label>
                <Select value={aiCountry} onValueChange={setAiCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">🌍 Global</SelectItem>
                    <SelectItem value="usa">🇺🇸 USA (Hollywood)</SelectItem>
                    <SelectItem value="japan">🇯🇵 Japan (Anime/Cinema)</SelectItem>
                    <SelectItem value="korea">🇰🇷 Korea (K-Drama)</SelectItem>
                    <SelectItem value="france">🇫🇷 France</SelectItem>
                    <SelectItem value="india">🇮🇳 India (Bollywood)</SelectItem>
                    <SelectItem value="uk">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="turkey">🇹🇷 Turkey (Dizi)</SelectItem>
                    <SelectItem value="spain">🇪🇸 Spain</SelectItem>
                    <SelectItem value="germany">🇩🇪 Germany</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>News Type</Label>
                <Select value={aiNewsType} onValueChange={setAiNewsType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">📰 Daily News</SelectItem>
                    <SelectItem value="weekly">📋 Weekly Roundup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAIGenerate} disabled={aiLoading} className="w-full gap-2">
              {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Wand2 className="h-4 w-4" /> Generate Article</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit News" : "Add News Manually"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="content" className="flex-1 min-w-[70px]">English</TabsTrigger>
              <TabsTrigger value="arabic" className="flex-1 min-w-[70px]">العربية</TabsTrigger>
              <TabsTrigger value="spanish" className="flex-1 min-w-[70px]">Español</TabsTrigger>
              <TabsTrigger value="french" className="flex-1 min-w-[70px]">Français</TabsTrigger>
              {extraLangs.map(l => (
                <TabsTrigger key={l.code} value={`extra-${l.code}`} className="flex-1 min-w-[70px]">{l.label}</TabsTrigger>
              ))}
              <TabsTrigger value="add-lang" className="min-w-[40px]"><Plus className="h-3 w-3" /></TabsTrigger>
              <TabsTrigger value="media" className="flex-1 min-w-[80px]">Media & SEO</TabsTrigger>
            </TabsList>

            {/* English (Original) */}
            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="space-y-1.5"><Label>Title (English) *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Excerpt</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label>Content</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Source Name</Label><Input value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5"><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. politics, elections, EU" /></div>
            </TabsContent>

            {/* Arabic (RTL) */}
            <TabsContent value="arabic" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Arabic content — displayed RTL automatically.</p>
                {editing && <Button size="sm" variant="outline" onClick={() => handleAITranslateLang("ar")} disabled={aiTranslatingLang === "ar"} className="gap-1">
                  {aiTranslatingLang === "ar" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} AI Translate
                </Button>}
              </div>
              <div className="space-y-1.5"><Label>العنوان (Title)</Label><Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} dir="rtl" className="text-right" /></div>
              <div className="space-y-1.5"><Label>المقتطف (Excerpt)</Label><Textarea value={form.excerpt_ar} onChange={(e) => setForm({ ...form, excerpt_ar: e.target.value })} rows={2} dir="rtl" className="text-right" /></div>
              <div className="space-y-1.5"><Label>المحتوى (Content)</Label><Textarea value={form.content_ar} onChange={(e) => setForm({ ...form, content_ar: e.target.value })} rows={10} dir="rtl" className="text-right" /></div>
            </TabsContent>

            {/* Spanish (LTR) */}
            <TabsContent value="spanish" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Spanish content — stored independently.</p>
                {editing && <Button size="sm" variant="outline" onClick={() => handleAITranslateLang("es")} disabled={aiTranslatingLang === "es"} className="gap-1">
                  {aiTranslatingLang === "es" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} AI Translate
                </Button>}
              </div>
              <div className="space-y-1.5"><Label>Título (Title)</Label><Input value={form.title_es} onChange={(e) => setForm({ ...form, title_es: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Extracto (Excerpt)</Label><Textarea value={form.excerpt_es} onChange={(e) => setForm({ ...form, excerpt_es: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label>Contenido (Content)</Label><Textarea value={form.content_es} onChange={(e) => setForm({ ...form, content_es: e.target.value })} rows={10} /></div>
            </TabsContent>

            {/* French (LTR) */}
            <TabsContent value="french" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">French content — stored independently.</p>
                {editing && <Button size="sm" variant="outline" onClick={() => handleAITranslateLang("fr")} disabled={aiTranslatingLang === "fr"} className="gap-1">
                  {aiTranslatingLang === "fr" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} AI Translate
                </Button>}
              </div>
              <div className="space-y-1.5"><Label>Titre (Title)</Label><Input value={form.title_fr} onChange={(e) => setForm({ ...form, title_fr: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Extrait (Excerpt)</Label><Textarea value={form.excerpt_fr} onChange={(e) => setForm({ ...form, excerpt_fr: e.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label>Contenu (Content)</Label><Textarea value={form.content_fr} onChange={(e) => setForm({ ...form, content_fr: e.target.value })} rows={10} /></div>
            </TabsContent>

            {/* Extra language tabs */}
            {extraLangs.map(lang => {
              const d = extraLangData[lang.code] || { title: "", excerpt: "", content: "" };
              return (
                <TabsContent key={lang.code} value={`extra-${lang.code}`} className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{lang.label} content — {lang.dir === "rtl" ? "RTL" : "LTR"}</p>
                    <div className="flex gap-2">
                      {editing && <Button size="sm" variant="outline" onClick={() => handleAITranslateLang(lang.code)} disabled={aiTranslatingLang === lang.code} className="gap-1">
                        {aiTranslatingLang === lang.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} AI Translate
                      </Button>}
                      <Button size="sm" variant="ghost" onClick={() => removeExtraLang(lang.code)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Title</Label><Input value={d.title} onChange={(e) => setExtraLangData(prev => ({ ...prev, [lang.code]: { ...d, title: e.target.value } }))} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} /></div>
                  <div className="space-y-1.5"><Label>Excerpt</Label><Textarea value={d.excerpt} onChange={(e) => setExtraLangData(prev => ({ ...prev, [lang.code]: { ...d, excerpt: e.target.value } }))} rows={2} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} /></div>
                  <div className="space-y-1.5"><Label>Content</Label><Textarea value={d.content} onChange={(e) => setExtraLangData(prev => ({ ...prev, [lang.code]: { ...d, content: e.target.value } }))} rows={10} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} /></div>
                </TabsContent>
              );
            })}

            {/* Add new language tab */}
            <TabsContent value="add-lang" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Add a new language for this article.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Language Code</Label>
                  <Input value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder="e.g. de, pt, ja" maxLength={5} />
                </div>
                <div className="space-y-1.5">
                  <Label>Language Name</Label>
                  <Input value={newLangLabel} onChange={(e) => setNewLangLabel(e.target.value)} placeholder="e.g. Deutsch" />
                </div>
              </div>
              <Button onClick={addNewLang} variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Add Language</Button>
              {extraLangs.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {extraLangs.map(l => (
                    <span key={l.code} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                      {l.label} ({l.code})
                      <button onClick={() => removeExtraLang(l.code)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Media & SEO */}
            <TabsContent value="media" className="space-y-4 mt-4">
              <div className="space-y-1.5"><Label>Cover Image</Label><ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} bucket="content" folder="news" /></div>
              <div className="space-y-1.5"><Label>Video URL</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="YouTube or direct video link" /></div>
              <div className="space-y-1.5"><Label>Source URL</Label><Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://..." /></div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish All Dialog */}
      <Dialog open={publishAllOpen} onOpenChange={setPublishAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-green-500" /> Publish Draft Articles</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {items.filter(n => n.status === "draft").length} draft articles available. Choose how many to publish:
            </p>
            <div className="space-y-1.5">
              <Label>Number of articles to publish</Label>
              <Input
                type="number"
                min={1}
                max={items.filter(n => n.status === "draft").length || 1}
                value={publishCount}
                onChange={(e) => setPublishCount(Number(e.target.value))}
              />
            </div>
            <Button onClick={handlePublishAll} disabled={publishLoading} className="w-full gap-2">
              {publishLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</> : <><Send className="h-4 w-4" /> Publish {publishCount} Articles</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
