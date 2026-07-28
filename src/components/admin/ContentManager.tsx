import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import { Plus, Pencil, Trash2, Loader2, Bell, Languages, Wand2, X, Crown } from "lucide-react";
import { ImageUpload, MultiImageUpload } from "./ImageUpload";
import { pingGoogleSitemap } from "@/lib/pingSitemap";

type ContentType = "movies" | "anime" | "articles" | "backgrounds";

interface ContentManagerProps { type: ContentType; title: string; }

interface ContentItem {
  id: string; title: string; description?: string | null; poster_url?: string | null;
  image_url?: string | null; cover_url?: string | null; excerpt?: string | null;
  content?: string | null; genre?: string[] | null; year?: number | null;
  rating?: number | null; trailer_url?: string | null; trending?: boolean | null;
  pinned?: boolean | null; watch_servers?: any; download_servers?: any;
  gallery_images?: string[] | null; created_at: string;
}

interface Server { name: string; url: string; quality?: string; size?: string; access_level?: "public" | "vip"; }

interface LangTranslation {
  title: string;
  description: string;
  content: string;
  genre: string;
}

const DEFAULT_LANGUAGES = [
  { code: "ar", label: "العربية", dir: "rtl" as const },
  { code: "fr", label: "Français", dir: "ltr" as const },
  { code: "es", label: "Español", dir: "ltr" as const },
  { code: "de", label: "Deutsch", dir: "ltr" as const },
  { code: "pt", label: "Português", dir: "ltr" as const },
  { code: "ja", label: "日本語", dir: "ltr" as const },
];

const textFields: Record<ContentType, string[]> = {
  movies: ["title", "description", "year", "trailer_url"],
  anime: ["title", "description", "year", "trailer_url"],
  articles: ["title", "excerpt", "content", "category", "tags"],
  backgrounds: ["title"],
};

const contentTypeMap: Record<ContentType, string> = {
  movies: "movie", anime: "anime", articles: "article", backgrounds: "background",
};

export function ContentManager({ type, title }: ContentManagerProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [watchServers, setWatchServers] = useState<Server[]>([]);
  const [downloadServers, setDownloadServers] = useState<Server[]>([]);
  const [notifyUsers, setNotifyUsers] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  // Language translations state
  const [langTranslations, setLangTranslations] = useState<Record<string, LangTranslation>>({});
  const [extraLanguages, setExtraLanguages] = useState<{ code: string; label: string; dir: "ltr" | "rtl" }[]>([]);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangLabel, setNewLangLabel] = useState("");
  const [aiTranslatingLang, setAiTranslatingLang] = useState<string | null>(null);

  const fields = textFields[type];
  const hasImage = type !== "backgrounds";
  const hasServers = type === "movies" || type === "anime";
  const hasGallery = type === "movies" || type === "anime";
  const isMedia = type === "movies" || type === "anime";
  const showLangTabs = type !== "backgrounds";

  const allLanguages = [...DEFAULT_LANGUAGES, ...extraLanguages];

  const fetchItems = async () => {
    const { data } = await supabase.from(type).select("*").order("created_at", { ascending: false });
    setItems((data as ContentItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [type]);

  const loadTranslations = async (itemId: string) => {
    const { data } = await supabase
      .from("content_translations")
      .select("language, title, description, content")
      .eq("content_id", itemId)
      .eq("content_type", contentTypeMap[type]);

    const map: Record<string, LangTranslation> = {};
    const foundLangs = new Set<string>();
    (data || []).forEach((t: any) => {
      map[t.language] = { title: t.title || "", description: t.description || "", content: t.content || "", genre: Array.isArray(t.genre) ? t.genre.join(", ") : "" };
      foundLangs.add(t.language);
    });
    setLangTranslations(map);

    // Auto-add extra language tabs for translations not in defaults
    const defaultCodes = DEFAULT_LANGUAGES.map(l => l.code);
    const extras: { code: string; label: string; dir: "ltr" | "rtl" }[] = [];
    foundLangs.forEach(code => {
      if (!defaultCodes.includes(code)) {
        extras.push({ code, label: code.toUpperCase(), dir: code === "ar" ? "rtl" : "ltr" });
      }
    });
    setExtraLanguages(extras);
  };

  const openCreate = () => {
    setEditing(null); setForm({}); setWatchServers([]); setDownloadServers([]);
    setLangTranslations({}); setExtraLanguages([]);
    setDialogOpen(true);
  };

  const openEdit = async (item: ContentItem) => {
    setEditing(item);
    const f: Record<string, any> = {};
    fields.forEach((k) => { const val = (item as any)[k]; f[k] = Array.isArray(val) ? val.join(", ") : val ?? ""; });
    f.poster_url = item.poster_url || ""; f.image_url = item.image_url || ""; f.cover_url = item.cover_url || "";
    f.gallery_images = item.gallery_images || []; f.trending = item.trending || false; f.pinned = item.pinned || false;
    f.vip_only = (item as any).vip_only || false;
    f.featured = (item as any).featured || false;
    f.status = (item as any).status || "published";
    f.published_at = (item as any).published_at || "";
    setWatchServers(Array.isArray(item.watch_servers) ? item.watch_servers : []);
    setDownloadServers(Array.isArray(item.download_servers) ? item.download_servers : []);
    setForm(f);
    await loadTranslations(item.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error(t("admin.titleRequired")); return; }
    setSaving(true);
    const payload: Record<string, any> = {};
    fields.forEach((k) => { let val = form[k]; if (k === "year") val = val ? Number(val) : null; payload[k] = val || null; });
    // Genre is now on main tab separately for media types
    if (type === "movies" || type === "anime") {
      const genreVal = form.genre;
      payload.genre = typeof genreVal === "string" ? genreVal.split(",").map((s: string) => s.trim()).filter(Boolean) : genreVal || [];
      payload.poster_url = form.poster_url || null; payload.gallery_images = form.gallery_images || []; payload.trending = form.trending || false; payload.pinned = form.pinned || false;
      payload.vip_only = form.vip_only || false;
    }
    if (type === "articles") {
      payload.cover_url = form.cover_url || null;
      payload.featured = form.featured || false;
      payload.status = form.status || "published";
      payload.published_at = form.published_at || new Date().toISOString();
      if (typeof payload.tags === "string") payload.tags = payload.tags.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    if (type === "backgrounds") payload.image_url = form.image_url || null;
    if (hasServers) { payload.watch_servers = watchServers; payload.download_servers = downloadServers; }

    let savedId: string | null = null;
    if (editing) {
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from(type).update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success(`${title} updated`);
      savedId = editing.id;
    } else {
      payload.created_by = user?.id;
      const { data: inserted, error } = await supabase.from(type).insert(payload as any).select().single();
      if (error) { toast.error(error.message); }
      else {
        toast.success(`${title} created`);
        savedId = inserted?.id || null;
        if (notifyUsers && inserted) {
          try {
            await supabase.functions.invoke("notify-new-content", { body: { content_type: contentTypeMap[type], content_id: inserted.id, title: inserted.title, description: (inserted as any).description || (inserted as any).excerpt || null, poster_url: (inserted as any).poster_url || (inserted as any).cover_url || (inserted as any).image_url || null, send_email: sendEmail } });
            toast.success(t("toast.notificationsSent"));
          } catch { toast.error(t("toast.failedNotifications")); }
        }
      }
    }

    // Save language translations
    if (savedId && showLangTabs) {
      for (const lang of allLanguages) {
        const tr = langTranslations[lang.code];
        if (tr && (tr.title.trim() || tr.description.trim() || tr.content.trim() || tr.genre.trim())) {
          const genreArr = tr.genre.trim() ? tr.genre.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
          await supabase.from("content_translations").upsert(
            {
              content_id: savedId,
              content_type: contentTypeMap[type],
              language: lang.code,
              title: tr.title.trim() || form.title?.trim() || "",
              description: tr.description.trim() || null,
              content: tr.content.trim() || null,
              genre: genreArr.length > 0 ? genreArr : null,
            } as any,
            { onConflict: "content_id,content_type,language" }
          );
        }
      }
    }

    setSaving(false); setDialogOpen(false); fetchItems();

    // Notify Google about the sitemap update (fire-and-forget, never blocks UI).
    if (!editing) pingGoogleSitemap();
  };

  const handleDelete = async (id: string) => {
    zarynConfirm({
      title: "Delete Content",
      message: "Are you sure you want to delete this item?",
      type: "warning",
      confirmLabel: "Delete",
      onConfirm: async () => {
        const { error } = await supabase.from(type).delete().eq("id", id);
        if (error) toast.error(error.message); else { toast.success("Deleted"); fetchItems(); }
      },
    });
  };

  const handleAITranslate = async (langCode: string) => {
    if (!editing && !form.title?.trim()) { toast.error("Save the content first"); return; }
    const itemId = editing?.id;
    if (!itemId) { toast.error("Save the content first before translating"); return; }

    setAiTranslatingLang(langCode);
    try {
      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: {
          contentId: itemId,
          contentType: contentTypeMap[type],
          title: form.title || editing?.title || "",
          description: isMedia ? (form.description || editing?.description || "") : (form.content || form.excerpt || editing?.content || editing?.excerpt || ""),
          targetLanguage: langCode,
          forceTranslate: true,
        },
      });
      if (error) throw error;

      // Reload translations
      await loadTranslations(itemId);
      toast.success(`Translated to ${allLanguages.find(l => l.code === langCode)?.label || langCode}`);
    } catch (e: any) {
      toast.error(e.message || "Translation failed");
    }
    setAiTranslatingLang(null);
  };

  const addNewLanguage = () => {
    if (!newLangCode.trim() || !newLangLabel.trim()) { toast.error("Enter language code and name"); return; }
    const code = newLangCode.trim().toLowerCase();
    if (allLanguages.find(l => l.code === code)) { toast.error("Language already exists"); return; }
    setExtraLanguages([...extraLanguages, { code, label: newLangLabel.trim(), dir: code === "ar" ? "rtl" : "ltr" }]);
    setNewLangCode("");
    setNewLangLabel("");
  };

  const removeExtraLang = (code: string) => {
    setExtraLanguages(extraLanguages.filter(l => l.code !== code));
    const copy = { ...langTranslations };
    delete copy[code];
    setLangTranslations(copy);
  };

  const updateLangField = (lang: string, field: keyof LangTranslation, value: string) => {
    setLangTranslations(prev => ({
      ...prev,
      [lang]: { ...(prev[lang] || { title: "", description: "", content: "", genre: "" }), [field]: value },
    }));
  };

  const getImageUrl = (item: ContentItem) => item.poster_url || item.image_url || item.cover_url;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">{title}</h1>
          <p className="text-muted-foreground mt-1">{items.length} {t("admin.items")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-brand text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" /> {t("admin.addNew")} {title.replace(/s$/, "")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-border/50 bg-card/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>{editing ? t("admin.edit") : t("admin.addNew")} {title.replace(/s$/, "")}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="main" className="w-full">
              <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                <TabsTrigger value="main" className="flex-1 min-w-[70px]">
                  {type === "articles" ? "English" : "Main"}
                </TabsTrigger>
                {showLangTabs && allLanguages.map(lang => (
                  <TabsTrigger key={lang.code} value={`lang-${lang.code}`} className="flex-1 min-w-[70px]">
                    {lang.label}
                  </TabsTrigger>
                ))}
                {showLangTabs && (
                  <TabsTrigger value="add-lang" className="min-w-[40px]">
                    <Plus className="h-3 w-3" />
                  </TabsTrigger>
                )}
                <TabsTrigger value="media" className="flex-1 min-w-[80px]">Media & SEO</TabsTrigger>
              </TabsList>

              {/* Main content tab */}
              <TabsContent value="main" className="space-y-4 pt-2">
                {fields.map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="capitalize text-foreground">{field.replace(/_/g, " ")}</Label>
                    {field === "description" || field === "content" || field === "excerpt" ? (
                      <Textarea value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="border-border/50 bg-background/50" rows={field === "content" ? 12 : 3} placeholder={field === "content" ? "Supports HTML: <h2>, <p>, <a>, <img>, <strong>, <em>..." : ""} />
                    ) : (
                      <Input value={form[field] || ""} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="border-border/50 bg-background/50" type={field === "year" ? "number" : "text"} placeholder={field === "genre" ? "Action, Drama, Comedy" : field === "trailer_url" ? "YouTube URL or direct video link" : field === "tags" ? "Review, Opinion, News" : field === "category" ? "e.g. Reviews, News, Guides" : ""} />
                    )}
                  </div>
                ))}

                {isMedia && (
                  <div className="space-y-1.5">
                    <Label className="capitalize text-foreground">Genre (Main / English)</Label>
                    <Input value={form.genre || ""} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="border-border/50 bg-background/50" placeholder="Action, Drama, Comedy" />
                  </div>
                )}

                {type === "articles" && (
                  <div className="space-y-4">
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2"><Switch checked={form.featured || false} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><Label className="text-foreground">Featured</Label></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-foreground">Status</Label>
                        <select value={form.status || "published"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground">
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="scheduled">Scheduled</option>
                        </select>
                      </div>
                      {form.status === "scheduled" && (
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Publish Date</Label>
                          <Input type="datetime-local" value={form.published_at ? new Date(form.published_at).toISOString().slice(0, 16) : ""} onChange={(e) => setForm({ ...form, published_at: new Date(e.target.value).toISOString() })} className="border-border/50 bg-background/50" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(type === "movies" || type === "anime") && (
                  <div className="flex gap-6 flex-wrap">
                    <div className="flex items-center gap-2"><Switch checked={form.trending || false} onCheckedChange={(v) => setForm({ ...form, trending: v })} /><Label className="text-foreground">{t("admin.trending")}</Label></div>
                    <div className="flex items-center gap-2"><Switch checked={form.pinned || false} onCheckedChange={(v) => setForm({ ...form, pinned: v })} /><Label className="text-foreground">{t("admin.pinned")}</Label></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.vip_only || false} onCheckedChange={(v) => setForm({ ...form, vip_only: v })} />
                      <Label className="text-foreground flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-amber-500" /> VIP Only</Label>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Language translation tabs */}
              {showLangTabs && allLanguages.map(lang => {
                const tr = langTranslations[lang.code] || { title: "", description: "", content: "", genre: "" };
                const isExtraLang = extraLanguages.find(l => l.code === lang.code);
                return (
                  <TabsContent key={lang.code} value={`lang-${lang.code}`} className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {lang.label} content — {lang.dir === "rtl" ? "RTL" : "LTR"}. Stored independently.
                      </p>
                      <div className="flex gap-2">
                        {editing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAITranslate(lang.code)}
                            disabled={aiTranslatingLang === lang.code}
                            className="gap-1"
                          >
                            {aiTranslatingLang === lang.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                            AI Translate
                          </Button>
                        )}
                        {isExtraLang && (
                          <Button size="sm" variant="ghost" onClick={() => removeExtraLang(lang.code)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isMedia ? (
                      <>
                        <div className="space-y-1.5">
                          <Label>Title</Label>
                          <Input value={tr.title} onChange={(e) => updateLangField(lang.code, "title", e.target.value)} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} placeholder="Leave empty to keep original title" />
                          {type === "movies" && <p className="text-xs text-muted-foreground">Movie titles are typically kept in original language</p>}
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
                      </>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label>Title</Label>
                          <Input value={tr.title} onChange={(e) => updateLangField(lang.code, "title", e.target.value)} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Excerpt / Summary</Label>
                          <Textarea value={tr.description} onChange={(e) => updateLangField(lang.code, "description", e.target.value)} rows={3} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Full Content</Label>
                          <Textarea value={tr.content} onChange={(e) => updateLangField(lang.code, "content", e.target.value)} rows={10} dir={lang.dir} className={lang.dir === "rtl" ? "text-right" : ""} />
                        </div>
                      </>
                    )}
                  </TabsContent>
                );
              })}

              {/* Add new language tab */}
              {showLangTabs && (
                <TabsContent value="add-lang" className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">Add a new language for this content.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Language Code</Label>
                      <Input value={newLangCode} onChange={(e) => setNewLangCode(e.target.value)} placeholder="e.g. de, pt, ja, ko" maxLength={5} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Language Name</Label>
                      <Input value={newLangLabel} onChange={(e) => setNewLangLabel(e.target.value)} placeholder="e.g. Deutsch, Português" />
                    </div>
                  </div>
                  <Button onClick={addNewLanguage} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Add Language
                  </Button>
                  {extraLanguages.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {extraLanguages.map(l => (
                        <span key={l.code} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                          {l.label} ({l.code})
                          <button onClick={() => removeExtraLang(l.code)}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Media & SEO tab */}
              <TabsContent value="media" className="space-y-4 pt-2">
                {(type === "movies" || type === "anime") && <ImageUpload bucket="content" folder={type} value={form.poster_url || ""} onChange={(url) => setForm({ ...form, poster_url: url })} label="Poster Image" />}
                {type === "articles" && <ImageUpload bucket="content" folder="articles" value={form.cover_url || ""} onChange={(url) => setForm({ ...form, cover_url: url })} label="Cover Image" />}
                {type === "backgrounds" && <ImageUpload bucket="content" folder="backgrounds" value={form.image_url || ""} onChange={(url) => setForm({ ...form, image_url: url })} label="Background Image" />}
                {hasGallery && <MultiImageUpload bucket="content" folder={`${type}/gallery`} value={form.gallery_images || []} onChange={(urls) => setForm({ ...form, gallery_images: urls })} label="Gallery Images" max={10} />}
                {hasServers && (
                  <>
                    <ServerEditor label={t("servers.watchServers")} servers={watchServers} setServers={setWatchServers} />
                    <ServerEditor label={t("servers.downloadServers")} servers={downloadServers} setServers={setDownloadServers} showSize />
                  </>
                )}
              </TabsContent>
            </Tabs>

            <div className="space-y-4 pt-2">
              {!editing && (
                <div className="rounded-xl border border-border/30 bg-background/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Bell className="h-4 w-4 text-primary" /> {t("admin.notifyUsers")}</div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="notify" checked={notifyUsers} onCheckedChange={(v) => setNotifyUsers(!!v)} />
                    <label htmlFor="notify" className="text-sm text-muted-foreground cursor-pointer">{t("admin.sendInApp")}</label>
                  </div>
                  {notifyUsers && (
                    <div className="flex items-center gap-2 ml-6">
                      <Checkbox id="email" checked={sendEmail} onCheckedChange={(v) => setSendEmail(!!v)} />
                      <label htmlFor="email" className="text-sm text-muted-foreground cursor-pointer">{t("admin.sendEmail")}</label>
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
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">{t("admin.image")}</TableHead>
                <TableHead className="text-muted-foreground">Title</TableHead>
                {(type === "movies" || type === "anime") && <TableHead className="text-muted-foreground">{t("admin.year")}</TableHead>}
                <TableHead className="text-muted-foreground text-right">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-border/50">
                  <TableCell>{getImageUrl(item) ? <img src={getImageUrl(item)!} alt={item.title} className="h-12 w-9 rounded object-cover" /> : <div className="h-12 w-9 rounded bg-muted" />}</TableCell>
                  <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                  {(type === "movies" || type === "anime") && <TableCell className="text-muted-foreground">{item.year || "—"}</TableCell>}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("admin.noItems")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ServerEditor({ label, servers, setServers, showSize }: { label: string; servers: Server[]; setServers: (s: Server[]) => void; showSize?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setServers([...servers, { name: "", url: "", quality: "", size: "", access_level: "public" }])}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {servers.map((server, i) => (
        <div key={i} className="space-y-2">
          <div className="flex gap-2 items-start flex-wrap sm:flex-nowrap">
            <Input placeholder="Server name" value={server.name} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], name: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 flex-1 min-w-[120px]" />
            <Input placeholder="URL" value={server.url} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], url: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 flex-1 min-w-[120px]" />
            <Input placeholder="Quality" value={server.quality || ""} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], quality: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 w-24" />
            {showSize && (
              <Input placeholder="Size (e.g. 1.2 GB)" value={server.size || ""} onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], size: e.target.value }; setServers(s); }} className="border-border/50 bg-background/50 w-28" />
            )}
            <select
              value={server.access_level || "public"}
              onChange={(e) => { const s = [...servers]; s[i] = { ...s[i], access_level: e.target.value as "public" | "vip" }; setServers(s); }}
              className="rounded-md border border-border/50 bg-background/50 px-2 py-2 text-xs text-foreground w-20"
            >
              <option value="public">Public</option>
              <option value="vip">VIP</option>
            </select>
            <Button variant="ghost" size="icon" onClick={() => setServers(servers.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}
