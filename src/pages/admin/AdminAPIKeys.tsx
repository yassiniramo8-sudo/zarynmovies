import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Key, Plus, Trash2, Eye, EyeOff, RefreshCw, Loader2, Shield, CheckCircle, XCircle, ShieldCheck } from "lucide-react";

const SUPPORTED_SOURCES = [
  { value: "tmdb", label: "TMDB (The Movie Database)", description: "Movies, TV shows, anime metadata" },
  { value: "youtube", label: "YouTube Data API", description: "Trailers, channels, video metadata" },
  { value: "omdb", label: "OMDb API", description: "Movie & series ratings, plot details" },
  { value: "tvdb", label: "TheTVDB", description: "TV series episodes and metadata" },
  { value: "jikan", label: "Jikan (MyAnimeList)", description: "Anime & manga data from MAL" },
  { value: "anilist", label: "AniList", description: "Anime & manga database" },
  { value: "kitsu", label: "Kitsu", description: "Anime streaming & tracking" },
  { value: "imdb", label: "IMDb", description: "Movie & TV show ratings" },
  { value: "trakt", label: "Trakt.tv", description: "TV show tracking & recommendations" },
  { value: "fanart", label: "FanArt.tv", description: "High-quality artwork & posters" },
  { value: "custom", label: "Custom Source", description: "Any other API source" },
];

type ApiKeyRow = {
  id: string;
  source_name: string;
  api_key: string;
  is_active: boolean;
  auto_use: boolean;
  created_at: string;
};

export default function AdminAPIKeys() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [source, setSource] = useState("");
  const [customSource, setCustomSource] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [verifyingKeys, setVerifyingKeys] = useState<Set<string>>(new Set());
  const [verifyResults, setVerifyResults] = useState<Record<string, { valid: boolean; message: string }>>({});

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["entertainment-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entertainment_api_keys" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ApiKeyRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const sourceName = source === "custom" ? customSource : source;
      if (!sourceName || !apiKey) throw new Error("Source and API key are required");
      const { error } = await supabase.from("entertainment_api_keys" as any).insert({
        source_name: sourceName,
        api_key: apiKey,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entertainment-api-keys"] });
      toast({ title: "API Key Added", description: "The key will be used automatically for content enrichment." });
      setDialogOpen(false);
      setSource("");
      setCustomSource("");
      setApiKey("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("entertainment_api_keys" as any).update({ [field]: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entertainment-api-keys"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entertainment_api_keys" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entertainment-api-keys"] });
      toast({ title: "Key Deleted" });
    },
  });

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.substring(0, 6) + "••••••••" + key.substring(key.length - 4);
  const getSourceInfo = (name: string) => SUPPORTED_SOURCES.find(s => s.value === name);

  const verifyKey = async (id: string, sourceName: string, keyValue: string) => {
    setVerifyingKeys(prev => new Set(prev).add(id));
    setVerifyResults(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const { data, error } = await supabase.functions.invoke("entertainment-ai", {
        body: { action: "verify_key", source_name: sourceName, api_key: keyValue },
      });
      if (error) throw error;
      setVerifyResults(prev => ({ ...prev, [id]: { valid: data.valid, message: data.message } }));
      toast({
        title: data.valid ? "Key Valid ✅" : "Key Invalid ❌",
        description: data.message,
        variant: data.valid ? "default" : "destructive",
      });
    } catch (e: any) {
      setVerifyResults(prev => ({ ...prev, [id]: { valid: false, message: e.message } }));
      toast({ title: "Verification Failed", description: e.message, variant: "destructive" });
    } finally {
      setVerifyingKeys(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const [dialogVerifying, setDialogVerifying] = useState(false);
  const [dialogVerifyResult, setDialogVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);

  const verifyNewKey = async () => {
    const sourceName = source === "custom" ? customSource : source;
    if (!sourceName || !apiKey) return;
    setDialogVerifying(true);
    setDialogVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("entertainment-ai", {
        body: { action: "verify_key", source_name: sourceName, api_key: apiKey },
      });
      if (error) throw error;
      setDialogVerifyResult({ valid: data.valid, message: data.message });
    } catch (e: any) {
      setDialogVerifyResult({ valid: false, message: e.message });
    } finally {
      setDialogVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" /> API Keys Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add API keys for external sources to enrich content with metadata, images, and trailers.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add API Key
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-foreground">
            <p className="font-medium">How API Keys Work</p>
            <ul className="mt-1 space-y-1 text-muted-foreground list-disc pl-4">
              <li>Keys are stored securely and used server-side only</li>
              <li>The AI automatically selects the right key per source</li>
              <li>Enable <strong>Auto Use</strong> to let the system pick the best key</li>
              <li>Content fetched via keys is enriched with SEO, translations, and metadata</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Keys list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No API keys configured yet.</p>
            <p className="text-sm">Add a key to start enriching content from external sources.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {keys.map((key) => {
            const info = getSourceInfo(key.source_name);
            return (
              <Card key={key.id} className={`transition-opacity ${!key.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm uppercase shrink-0">
                        {key.source_name.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {info?.label || key.source_name.toUpperCase()}
                          </h3>
                          <Badge variant={key.is_active ? "default" : "secondary"} className="text-xs">
                            {key.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {key.auto_use && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <RefreshCw className="h-3 w-3" /> Auto
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {info?.description || "Custom API source"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Key display */}
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono text-muted-foreground">
                        {visibleKeys.has(key.id) ? key.api_key : maskKey(key.api_key)}
                      </code>
                      <Button variant="ghost" size="icon" onClick={() => toggleVisibility(key.id)}>
                        {visibleKeys.has(key.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>

                      {/* Toggles */}
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Active</Label>
                        <Switch
                          checked={key.is_active}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: key.id, field: "is_active", value: v })}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Auto</Label>
                        <Switch
                          checked={key.auto_use}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: key.id, field: "auto_use", value: v })}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        disabled={verifyingKeys.has(key.id)}
                        onClick={() => verifyKey(key.id, key.source_name, key.api_key)}
                      >
                        {verifyingKeys.has(key.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : verifyResults[key.id]?.valid === true ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : verifyResults[key.id]?.valid === false ? (
                          <XCircle className="h-3 w-3 text-destructive" />
                        ) : (
                          <ShieldCheck className="h-3 w-3" />
                        )}
                        Verify
                      </Button>

                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(key.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {verifyResults[key.id] && (
                    <div className={`mt-2 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 ${verifyResults[key.id].valid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                      {verifyResults[key.id].valid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {verifyResults[key.id].message}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> Add New API Key
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Select a source..." /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_SOURCES.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="font-medium">{s.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">— {s.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {source === "custom" && (
              <div>
                <Label>Custom Source Name</Label>
                <Input value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder="e.g. myapi" />
              </div>
            )}
            <div>
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input value={apiKey} onChange={e => { setApiKey(e.target.value); setDialogVerifyResult(null); }} placeholder="Paste your API key here..." type="password" className="flex-1" />
                <Button variant="outline" size="sm" disabled={dialogVerifying || !source || !apiKey} onClick={verifyNewKey} className="gap-1 shrink-0">
                  {dialogVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                  Verify
                </Button>
              </div>
              {dialogVerifyResult && (
                <div className={`mt-2 px-3 py-1.5 rounded text-xs flex items-center gap-1.5 ${dialogVerifyResult.valid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                  {dialogVerifyResult.valid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {dialogVerifyResult.message}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setDialogVerifyResult(null); }}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !source || !apiKey}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
