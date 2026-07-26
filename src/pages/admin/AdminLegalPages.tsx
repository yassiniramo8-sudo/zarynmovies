import { useState } from "react";
import { useAllLegalPages, useSaveLegalPage, useLegalPageHistory } from "@/hooks/useLegalPages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Save, History, Plus, Languages, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const PAGE_KEYS = [
  { key: "privacy_policy", label: "سياسة الخصوصية", labelEn: "Privacy Policy" },
  { key: "terms_of_service", label: "شروط الاستخدام", labelEn: "Terms of Service" },
  { key: "about_us", label: "من نحن", labelEn: "About Us" },
  { key: "contact_us", label: "اتصل بنا", labelEn: "Contact Us" },
  { key: "dmca", label: "DMCA", labelEn: "DMCA Policy" },
];

const LANGUAGES = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "pt", label: "Português" },
  { code: "hi", label: "हिन्दी" },
];

export default function AdminLegalPages() {
  const { data: pages, isLoading } = useAllLegalPages();
  const saveMutation = useSaveLegalPage();
  const [selectedPage, setSelectedPage] = useState(PAGE_KEYS[0].key);
  const [selectedLang, setSelectedLang] = useState("ar");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [historyPage, setHistoryPage] = useState<{ key: string; lang: string } | null>(null);

  const currentPage = pages?.find(p => p.page_key === selectedPage && p.language === selectedLang);

  const loadPage = (pageKey: string, lang: string) => {
    setSelectedPage(pageKey);
    setSelectedLang(lang);
    const page = pages?.find(p => p.page_key === pageKey && p.language === lang);
    if (page) {
      setEditTitle(page.title);
      setEditContent(page.content);
    } else {
      setEditTitle("");
      setEditContent("");
    }
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      await saveMutation.mutateAsync({
        page_key: selectedPage,
        language: selectedLang,
        title: editTitle,
        content: editContent,
      });
      toast.success("Page saved successfully! A new version has been created.");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display">Legal Pages Manager</h1>
        <p className="text-muted-foreground mt-1">Edit legal pages content in any language with version history</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Page List */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" /> Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="mb-3">
              <Label className="text-xs text-muted-foreground">Language</Label>
              <Select value={selectedLang} onValueChange={setSelectedLang}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => (
                    <SelectItem key={l.code} value={l.code}>
                      <span className="flex items-center gap-2">
                        <Languages className="h-3 w-3" /> {l.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {PAGE_KEYS.map(pk => {
              const exists = pages?.some(p => p.page_key === pk.key && p.language === selectedLang);
              return (
                <button
                  key={pk.key}
                  onClick={() => loadPage(pk.key, selectedLang)}
                  className={`w-full text-start rounded-lg border p-3 transition-colors ${
                    selectedPage === pk.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/30 bg-muted/20 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{pk.label}</span>
                    {exists ? (
                      <Badge variant="outline" className="text-xs">✓</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <Plus className="h-3 w-3 mr-1" /> New
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{pk.labelEn}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {PAGE_KEYS.find(p => p.key === selectedPage)?.label} — {LANGUAGES.find(l => l.code === selectedLang)?.label}
              </CardTitle>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setHistoryPage({ key: selectedPage, lang: selectedLang })}>
                      <History className="h-3 w-3" /> History
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Version History</DialogTitle>
                    </DialogHeader>
                    {historyPage && <VersionHistory pageKey={historyPage.key} language={historyPage.lang} onRestore={(title, content) => {
                      setEditTitle(title);
                      setEditContent(content);
                      setEditing(true);
                      toast.info("Content loaded from history. Click Save to create a new version.");
                    }} />}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentPage && !editing && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Version {currentPage.version} — Updated {new Date(currentPage.updated_at).toLocaleString()}
              </div>
            )}
            <div className="space-y-2">
              <Label>Page Title</Label>
              <Input
                value={editTitle}
                onChange={e => { setEditTitle(e.target.value); setEditing(true); }}
                placeholder="Enter page title..."
              />
            </div>
            <div className="space-y-2">
              <Label>Content (HTML supported)</Label>
              <Textarea
                value={editContent}
                onChange={e => { setEditContent(e.target.value); setEditing(true); }}
                placeholder="Enter page content... HTML tags are supported for formatting."
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gradient-brand text-primary-foreground gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save as New Version"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function VersionHistory({ pageKey, language, onRestore }: { pageKey: string; language: string; onRestore: (title: string, content: string) => void }) {
  const { data: versions, isLoading } = useLegalPageHistory(pageKey, language);

  if (isLoading) return <p className="text-muted-foreground text-sm p-4">Loading...</p>;
  if (!versions?.length) return <p className="text-muted-foreground text-sm p-4">No versions found for this page/language.</p>;

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-3 p-1">
        {versions.map(v => (
          <div key={v.id} className="rounded-lg border border-border/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <Badge variant="outline" className="text-xs">v{v.version}</Badge>
                <span className="text-xs text-muted-foreground ml-2">{new Date(v.updated_at).toLocaleString()}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRestore(v.title, v.content)}>
                Restore
              </Button>
            </div>
            <p className="text-sm font-medium">{v.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{v.content.substring(0, 150)}...</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
