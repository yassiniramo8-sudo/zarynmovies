import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Languages, Search, Check, Edit3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ContentType = "movie" | "anime" | "series" | "sports_news" | "article";

const CONTENT_TYPES: { value: ContentType; label: string; table: string }[] = [
  { value: "movie", label: "Movies", table: "movies" },
  { value: "anime", label: "Anime", table: "anime" },
  { value: "series", label: "Series", table: "series" },
  { value: "sports_news", label: "News Articles", table: "sports_news" },
  { value: "article", label: "General Articles", table: "articles" },
];

const LANGUAGES = [
  { code: "ar", label: "العربية (Arabic)", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français (French)", dir: "ltr" },
  { code: "es", label: "Español (Spanish)", dir: "ltr" },
  { code: "de", label: "Deutsch (German)", dir: "ltr" },
  { code: "pt", label: "Português (Portuguese)", dir: "ltr" },
  { code: "ja", label: "日本語 (Japanese)", dir: "ltr" },
];

interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  excerpt?: string | null;
}

interface TranslationResult {
  title: string;
  description: string;
  content?: string;
  genre?: string[];
}

export default function AdminAITranslate() {
  const { toast } = useToast();
  const [contentType, setContentType] = useState<ContentType>("movie");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [targetLang, setTargetLang] = useState("ar");
  const [translating, setTranslating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedResult, setEditedResult] = useState<TranslationResult | null>(null);
  const [existingTranslations, setExistingTranslations] = useState<Record<string, TranslationResult>>({});
  const [saving, setSaving] = useState(false);

  // Search content
  const searchContent = async () => {
    setLoading(true);
    const cfg = CONTENT_TYPES.find((c) => c.value === contentType)!;
    let query = supabase.from(cfg.table as any).select("id, title").limit(50);

    if (searchQuery.trim()) {
      query = query.ilike("title", `%${searchQuery}%`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Fetch full details for each item
      const mapped: ContentItem[] = (data || []).map((d: any) => ({
        id: d.id,
        title: d.title,
      }));
      setItems(mapped);
    }
    setLoading(false);
  };

  // Select an item and load its full data + existing translations
  const selectItem = async (item: ContentItem) => {
    const cfg = CONTENT_TYPES.find((c) => c.value === contentType)!;

    // Fetch full item
    const selectFields =
      contentType === "sports_news"
        ? "id, title, title_ar, content, content_ar, excerpt, excerpt_ar"
        : contentType === "article"
        ? "id, title, content, excerpt"
        : "id, title, description";

    const { data } = await supabase
      .from(cfg.table as any)
      .select(selectFields)
      .eq("id", item.id)
      .single();

    if (data) {
      const full: ContentItem = {
        id: (data as any).id,
        title: (data as any).title,
        description: (data as any).description || null,
        content: (data as any).content || null,
        excerpt: (data as any).excerpt || null,
      };
      setSelectedItem(full);
      setResult(null);
      setEditMode(false);

      // Load existing translations
      await loadExistingTranslations(item.id);
    }
  };

  const loadExistingTranslations = async (contentId: string) => {
    const isNews = contentType === "sports_news";
    const existing: Record<string, TranslationResult> = {};

    if (isNews) {
      const { data } = await supabase
        .from("news_translations")
        .select("language, title, excerpt, content")
        .eq("news_id", contentId);
      (data || []).forEach((t: any) => {
        existing[t.language] = { title: t.title, description: t.excerpt || "", content: t.content || "" };
      });
    } else {
      const { data } = await supabase
        .from("content_translations")
        .select("language, title, description, content, genre")
        .eq("content_id", contentId)
        .eq("content_type", contentType);
      (data || []).forEach((t: any) => {
        existing[t.language] = { title: t.title, description: t.description || "", content: t.content || "", genre: t.genre || [] };
      });
    }
    setExistingTranslations(existing);
  };

  // AI Translate
  const translateWithAI = async () => {
    if (!selectedItem) return;
    setTranslating(true);

    const isMedia = ["movie", "anime", "series"].includes(contentType);
    const textToTranslate = isMedia
      ? selectedItem.description || ""
      : `${selectedItem.title}\n---\n${selectedItem.excerpt || ""}\n---\n${selectedItem.content || ""}`;

    try {
      let genre: string[] = [];
      if (isMedia) {
        const cfg = CONTENT_TYPES.find((c) => c.value === contentType)!;
        const { data: itemData } = await supabase
          .from(cfg.table as any)
          .select("genre")
          .eq("id", selectedItem.id)
          .single();
        genre = (itemData as any)?.genre || [];
      }

      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: {
          contentId: selectedItem.id,
          contentType,
          title: selectedItem.title,
          description: isMedia ? selectedItem.description || "" : selectedItem.content || selectedItem.excerpt || "",
          genre,
          targetLanguage: targetLang,
          forceTranslate: true,
        },
      });

      if (error) throw error;

      // After translation, reload existing translations
      await loadExistingTranslations(selectedItem.id);

      // Show the result for the target language
      const langDir = LANGUAGES.find((l) => l.code === targetLang)?.dir || "ltr";

      toast({ title: "✅ Translation complete", description: `Translated to ${LANGUAGES.find((l) => l.code === targetLang)?.label}` });

      // Load the freshly saved translation
      if (contentType === "sports_news") {
        const { data: t } = await supabase
          .from("news_translations")
          .select("title, excerpt, content")
          .eq("news_id", selectedItem.id)
          .eq("language", targetLang)
          .single();
        if (t) {
          const r = { title: t.title, description: t.excerpt || "", content: t.content || "" };
          setResult(r);
          setEditedResult(r);
        }
      } else {
        const { data: t } = await supabase
          .from("content_translations")
          .select("title, description, content, genre")
          .eq("content_id", selectedItem.id)
          .eq("content_type", contentType)
          .eq("language", targetLang)
          .single();
        if (t) {
          const r = { title: t.title, description: t.description || "", content: t.content || "", genre: t.genre || [] };
          setResult(r);
          setEditedResult(r);
        }
      }
    } catch (e: any) {
      toast({ title: "Translation failed", description: e.message, variant: "destructive" });
    }
    setTranslating(false);
  };

  // Save edited translation
  const saveEdited = async () => {
    if (!selectedItem || !editedResult) return;
    setSaving(true);

    try {
      if (contentType === "sports_news") {
        await supabase.from("news_translations").upsert(
          {
            news_id: selectedItem.id,
            language: targetLang,
            title: editedResult.title,
            excerpt: editedResult.description,
            content: editedResult.content || "",
          },
          { onConflict: "news_id,language" }
        );
      } else {
        await supabase.from("content_translations").upsert(
          {
            content_id: selectedItem.id,
            content_type: contentType,
            language: targetLang,
            title: editedResult.title,
            description: editedResult.description,
            content: editedResult.content || "",
            genre: editedResult.genre || [],
          },
          { onConflict: "content_id,content_type,language" }
        );
      }
      toast({ title: "✅ Saved", description: "Translation updated successfully" });
      setEditMode(false);
      setResult(editedResult);
      await loadExistingTranslations(selectedItem.id);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // Load existing translation for selected language tab
  const loadLangTranslation = (lang: string) => {
    setTargetLang(lang);
    const existing = existingTranslations[lang];
    if (existing) {
      setResult(existing);
      setEditedResult(existing);
    } else {
      setResult(null);
      setEditedResult(null);
    }
    setEditMode(false);
  };

  useEffect(() => {
    searchContent();
  }, [contentType]);

  const isMedia = ["movie", "anime", "series"].includes(contentType);
  const langConfig = LANGUAGES.find((l) => l.code === targetLang);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Translation Tool</h1>
        <p className="text-muted-foreground">Select content, choose a language, and translate with AI</p>
      </div>

      {/* Step 1: Content Type + Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Select Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            {CONTENT_TYPES.map((ct) => (
              <Button
                key={ct.value}
                variant={contentType === ct.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setContentType(ct.value);
                  setSelectedItem(null);
                  setResult(null);
                }}
              >
                {ct.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Search by title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchContent()} />
            <Button onClick={searchContent} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
              {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No content found</p>}
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedItem?.id === item.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Language & Translate */}
      {selectedItem && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              2. Translate: <span className="text-primary">{selectedItem.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Original content preview */}
            <div className="bg-muted/30 rounded-md p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Original Content</p>
              <p className="font-medium">{selectedItem.title}</p>
              {isMedia && selectedItem.description && <p className="text-sm text-muted-foreground line-clamp-3">{selectedItem.description}</p>}
              {!isMedia && selectedItem.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{selectedItem.excerpt}</p>}
            </div>

            {/* Existing translations badges */}
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs text-muted-foreground">Existing translations:</span>
              {LANGUAGES.map((l) => (
                <Badge key={l.code} variant={existingTranslations[l.code] ? "default" : "outline"} className="text-xs">
                  {existingTranslations[l.code] ? <Check className="h-3 w-3 mr-1" /> : null}
                  {l.code.toUpperCase()}
                </Badge>
              ))}
            </div>

            {/* Language tabs */}
            <Tabs value={targetLang} onValueChange={loadLangTranslation}>
              <TabsList className="w-full">
                {LANGUAGES.map((l) => (
                  <TabsTrigger key={l.code} value={l.code} className="flex-1">
                    {l.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {LANGUAGES.map((l) => (
                <TabsContent key={l.code} value={l.code} className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <Button onClick={translateWithAI} disabled={translating} className="gap-2">
                      {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                      Translate with AI to {l.label}
                    </Button>
                    {result && (
                      <Button variant="outline" onClick={() => { setEditMode(!editMode); setEditedResult(result); }} className="gap-2">
                        <Edit3 className="h-4 w-4" />
                        {editMode ? "Cancel Edit" : "Edit"}
                      </Button>
                    )}
                  </div>

                  {result && !editMode && (
                    <div className="bg-muted/20 border rounded-md p-4 space-y-3" dir={l.dir}>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Title</p>
                        <p className="font-medium">{result.title}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          {isMedia ? "Description" : "Summary / Excerpt"}
                        </p>
                        <p className="text-sm">{result.description}</p>
                      </div>
                      {result.content && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Full Content</p>
                          <p className="text-sm whitespace-pre-wrap">{result.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {editMode && editedResult && (
                    <div className="space-y-3 border rounded-md p-4" dir={l.dir}>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Title</label>
                        <Input
                          value={editedResult.title}
                          onChange={(e) => setEditedResult({ ...editedResult, title: e.target.value })}
                          dir={l.dir}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">
                          {isMedia ? "Description" : "Summary / Excerpt"}
                        </label>
                        <Textarea
                          value={editedResult.description}
                          onChange={(e) => setEditedResult({ ...editedResult, description: e.target.value })}
                          rows={4}
                          dir={l.dir}
                        />
                      </div>
                      {!isMedia && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Full Content</label>
                          <Textarea
                            value={editedResult.content || ""}
                            onChange={(e) => setEditedResult({ ...editedResult, content: e.target.value })}
                            rows={8}
                            dir={l.dir}
                          />
                        </div>
                      )}
                      <Button onClick={saveEdited} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save Translation
                      </Button>
                    </div>
                  )}

                  {!result && !translating && (
                    <p className="text-sm text-muted-foreground italic">No translation yet. Click "Translate with AI" to generate one.</p>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
