import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ContentBlockEditor,
  ContentBlock,
  blocksToHtml,
  htmlToBlocks,
} from "@/components/admin/ContentBlockEditor";
import {
  Sparkles, Search, Globe, Loader2, FileText, Eye, Send, Tag, Image as ImageIcon,
  CheckCircle2, X, Plus, RotateCcw, Code, Save, Layers,
} from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "tr", label: "Türkçe", dir: "ltr" },
  { code: "de", label: "Deutsch", dir: "ltr" },
  { code: "ja", label: "日本語", dir: "ltr" },
  { code: "ko", label: "한국어", dir: "ltr" },
  { code: "pt", label: "Português", dir: "ltr" },
  { code: "hi", label: "हिन्दी", dir: "ltr" },
];

type GeneratedArticle = {
  title: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  seo: {
    meta_title: string;
    meta_description: string;
    og_title: string;
    og_description: string;
    image_alts: string[];
  };
};

type SuggestedImage = { url: string; query: string; alt: string };

export default function AdminAIArticles() {
  const { user } = useAuth();
  const [step, setStep] = useState<"input" | "preview" | "published">("input");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("en");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [images, setImages] = useState<SuggestedImage[]>([]);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [editorMode, setEditorMode] = useState<"blocks" | "html">("blocks");

  const isRtl = LANGUAGES.find((l) => l.code === language)?.dir === "rtl";

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw));

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("Please enter a topic"); return; }
    setGenerating(true);

    try {
      // Generate article and fetch images in parallel
      const [articleRes, imagesRes] = await Promise.all([
        supabase.functions.invoke("ai-article-generator", {
          body: { topic, language, keywords, action: "generate" },
        }),
        supabase.functions.invoke("ai-article-generator", {
          body: { topic, language, action: "search_images" },
        }),
      ]);

      if (articleRes.error) throw new Error(articleRes.error.message);
      if (articleRes.data?.error) throw new Error(articleRes.data.error);

      const generatedArticle = articleRes.data.article;
      setArticle(generatedArticle);
      setContentBlocks(htmlToBlocks(generatedArticle.content || ""));
      if (imagesRes.data?.images) {
        setImages(imagesRes.data.images);
        if (imagesRes.data.images.length > 0) setSelectedCover(imagesRes.data.images[0].url);
      }
      setStep("preview");
      toast.success("Article generated successfully!");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (asDraft = false) => {
    if (!article || !user) return;
    setPublishing(true);

    try {
      const finalContent = editorMode === "blocks" ? blocksToHtml(contentBlocks) : article.content;
      const { error } = await supabase.from("articles").insert({
        title: article.title,
        content: finalContent,
        excerpt: article.excerpt,
        category: article.category,
        tags: article.tags,
        cover_url: selectedCover || null,
        status: asDraft ? "draft" : "published",
        featured: false,
        created_by: user.id,
        published_at: asDraft ? null : new Date().toISOString(),
      });

      if (error) throw error;
      setStep("published");
      toast.success(asDraft ? "Article saved as draft!" : "Article published!");
    } catch (e: any) {
      toast.error(e.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const reset = () => {
    setStep("input");
    setTopic("");
    setKeywords([]);
    setArticle(null);
    setImages([]);
    setSelectedCover(null);
    setContentBlocks([]);
  };

  // === STEP: Published ===
  if (step === "published") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle2 className="h-16 w-16 text-primary" />
        <h2 className="text-2xl font-bold font-display text-foreground">Article Published!</h2>
        <p className="text-muted-foreground">Your AI-generated article is now live on the website.</p>
        <Button onClick={reset} variant="outline" className="border-primary/50 text-primary">
          <Plus className="mr-2 h-4 w-4" /> Create Another Article
        </Button>
      </div>
    );
  }

  // === STEP: Preview & Edit ===
  if (step === "preview" && article) {
    return (
      <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
              <RotateCcw className="mr-2 h-4 w-4" /> Back
            </Button>
            <h1 className="text-2xl font-bold font-display text-foreground">Review & Publish</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>Discard</Button>
            <Button variant="outline" onClick={() => handlePublish(true)} disabled={publishing}>
              <Save className="mr-2 h-4 w-4" /> Save Draft
            </Button>
            <Button onClick={() => handlePublish(false)} disabled={publishing} className="bg-primary text-primary-foreground">
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Publish Article
            </Button>
          </div>
        </div>

        <Tabs defaultValue="preview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="preview"><Eye className="mr-2 h-4 w-4" /> Preview</TabsTrigger>
            <TabsTrigger value="seo"><Code className="mr-2 h-4 w-4" /> SEO</TabsTrigger>
            <TabsTrigger value="images"><ImageIcon className="mr-2 h-4 w-4" /> Images</TabsTrigger>
            <TabsTrigger value="edit"><Layers className="mr-2 h-4 w-4" /> Block Editor</TabsTrigger>
            <TabsTrigger value="html"><FileText className="mr-2 h-4 w-4" /> HTML</TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 space-y-4">
                {selectedCover && (
                  <img src={selectedCover} alt={article.title} className="w-full h-64 object-cover rounded-lg" />
                )}
                <h1 className="text-3xl font-bold font-display text-foreground">{article.title}</h1>
                <p className="text-muted-foreground italic">{article.excerpt}</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{article.category}</Badge>
                  {article.tags.map((t) => (
                    <Badge key={t} variant="outline" className="border-border/50">{t}</Badge>
                  ))}
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/50 bg-card/50">
                <CardHeader><CardTitle className="text-sm">Meta Tags</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Meta Title ({article.seo.meta_title.length}/60)</Label>
                    <Input value={article.seo.meta_title} onChange={(e) => setArticle({ ...article, seo: { ...article.seo, meta_title: e.target.value } })} className="border-border/50 bg-background/50" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Meta Description ({article.seo.meta_description.length}/160)</Label>
                    <Textarea value={article.seo.meta_description} onChange={(e) => setArticle({ ...article, seo: { ...article.seo, meta_description: e.target.value } })} className="border-border/50 bg-background/50" rows={3} />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/50">
                <CardHeader><CardTitle className="text-sm">OpenGraph</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">OG Title</Label>
                    <Input value={article.seo.og_title} onChange={(e) => setArticle({ ...article, seo: { ...article.seo, og_title: e.target.value } })} className="border-border/50 bg-background/50" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">OG Description</Label>
                    <Textarea value={article.seo.og_description} onChange={(e) => setArticle({ ...article, seo: { ...article.seo, og_description: e.target.value } })} className="border-border/50 bg-background/50" rows={3} />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/50 md:col-span-2">
                <CardHeader><CardTitle className="text-sm">JSON-LD Preview</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-auto max-h-48">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: article.seo.meta_title,
  description: article.seo.meta_description,
  image: selectedCover,
  author: { "@type": "Organization", name: "Zaryn Movies" },
  publisher: { "@type": "Organization", name: "Zaryn Movies", url: "https://zaryn.movies" },
  keywords: article.tags.join(", "),
}, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Images Tab */}
          <TabsContent value="images">
            <Card className="border-border/50 bg-card/50">
              <CardHeader><CardTitle className="text-sm">Select Cover Image</CardTitle></CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No images found. You can add a cover image manually after publishing.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCover(img.url)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${selectedCover === img.url ? "border-primary ring-2 ring-primary/30" : "border-border/50 hover:border-primary/50"}`}
                      >
                        <img src={img.url} alt={img.alt} className="w-full h-32 object-cover" />
                        {selectedCover === img.url && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground p-1 truncate">{img.query}</p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Label className="text-xs text-muted-foreground">Or paste a custom cover URL</Label>
                  <Input
                    placeholder="https://..."
                    value={selectedCover || ""}
                    onChange={(e) => setSelectedCover(e.target.value)}
                    className="border-border/50 bg-background/50 mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Block Editor Tab */}
          <TabsContent value="edit">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={article.title} onChange={(e) => setArticle({ ...article, title: e.target.value })} className="border-border/50 bg-background/50" dir={isRtl ? "rtl" : "ltr"} />
                </div>
                <div>
                  <Label>Excerpt</Label>
                  <Textarea value={article.excerpt} onChange={(e) => setArticle({ ...article, excerpt: e.target.value })} className="border-border/50 bg-background/50" rows={2} dir={isRtl ? "rtl" : "ltr"} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Input value={article.category} onChange={(e) => setArticle({ ...article, category: e.target.value })} className="border-border/50 bg-background/50" />
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-1">
                      {article.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="gap-1">
                          {t}
                          <button onClick={() => setArticle({ ...article, tags: article.tags.filter((x) => x !== t) })}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-primary" /> Content Blocks
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">Add text, images, videos, and links. Reorder blocks with arrows.</p>
                  <ContentBlockEditor
                    blocks={contentBlocks}
                    onChange={(blocks) => {
                      setContentBlocks(blocks);
                      setEditorMode("blocks");
                    }}
                    isRtl={isRtl}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Raw HTML Tab */}
          <TabsContent value="html">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6 space-y-4">
                <Label>Content (HTML)</Label>
                <Textarea
                  value={editorMode === "blocks" ? blocksToHtml(contentBlocks) : article.content}
                  onChange={(e) => {
                    setArticle({ ...article, content: e.target.value });
                    setEditorMode("html");
                  }}
                  className="border-border/50 bg-background/50 font-mono text-xs"
                  rows={20}
                  dir={isRtl ? "rtl" : "ltr"}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // === STEP: Input ===
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Sparkles className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">AI Article Generator</h1>
          <p className="text-sm text-muted-foreground">Generate professional, SEO-optimized articles with AI</p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 space-y-5">
          {/* Language */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Target Language
            </Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Article Topic / Headline
            </Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Top 10 Movies to Watch in 2025, How Anime Changed Global Pop Culture..."
              rows={3}
              className="border-border/50 bg-background/50 resize-none"
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Keywords (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                placeholder="Add a keyword..."
                className="border-border/50 bg-background/50"
              />
              <Button variant="outline" size="sm" onClick={addKeyword} className="border-border/50">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1">
                    {kw}
                    <button onClick={() => removeKeyword(kw)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button onClick={handleGenerate} disabled={generating} className="w-full bg-primary text-primary-foreground" size="lg">
            {generating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating article...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Article with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
