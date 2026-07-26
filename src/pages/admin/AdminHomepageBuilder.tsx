import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp, Loader2, Save, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useHomeLayout, HomeSection } from "@/hooks/useHomeLayout";

interface Collection {
  id: string; slug: string;
  title_i18n: any; description_i18n: any;
  banner_url: string | null; logo_url: string | null; theme_color: string | null;
  sort_order: number; active: boolean;
}
interface FooterLink {
  id: string; group_key: string; label_i18n: any; href: string; icon: string | null; sort_order: number; active: boolean;
}

function SectionEditor({ section, onSaved }: { section: HomeSection; onSaved: () => void }) {
  const [local, setLocal] = useState<HomeSection>(section);
  const [saving, setSaving] = useState(false);
  useEffect(() => setLocal(section), [section.id]);

  const patch = (p: Partial<HomeSection>) => setLocal({ ...local, ...p });
  const patchTitle = (lang: string, val: string) => patch({ title_i18n: { ...local.title_i18n, [lang]: val } });
  const patchSetting = (key: string, val: any) => patch({ settings: { ...(local.settings || {}), [key]: val } });

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("home_sections").update({
      title_i18n: local.title_i18n,
      description_i18n: local.description_i18n,
      enabled: local.enabled,
      sort_order: local.sort_order,
      settings: local.settings,
    }).eq("id", local.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); onSaved(); }
  };

  const move = async (dir: -1 | 1) => {
    await (supabase as any).from("home_sections").update({ sort_order: local.sort_order + dir * 5 }).eq("id", local.id);
    onSaved();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{local.title_i18n?.en || local.key}</CardTitle>
          <div className="text-xs text-muted-foreground">key: {local.key} · type: {local.type}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => move(-1)} title="Move up"><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => move(1)} title="Move down"><ArrowDown className="h-4 w-4" /></Button>
          <Switch checked={local.enabled} onCheckedChange={(v) => { patch({ enabled: v }); (supabase as any).from("home_sections").update({ enabled: v }).eq("id", local.id).then(onSaved); }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {["en", "ar", "fr", "es"].map((l) => (
            <div key={l}>
              <Label className="text-xs uppercase">{l}</Label>
              <Input value={local.title_i18n?.[l] || ""} onChange={(e) => patchTitle(l, e.target.value)} />
            </div>
          ))}
        </div>
        {(["trending", "popular_week", "most_viewed_today", "new_releases", "recently_added", "editor_picks", "ai_recs", "category", "vip", "continue_watching"].includes(local.type)) && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">Item count</Label>
              <Input type="number" value={local.settings?.itemCount ?? 20} onChange={(e) => patchSetting("itemCount", Number(e.target.value))} />
            </div>
            {local.type === "category" && (
              <>
                <div><Label className="text-xs">Genre</Label><Input value={local.settings?.genre || ""} onChange={(e) => patchSetting("genre", e.target.value)} /></div>
                <div><Label className="text-xs">Content type</Label><Input value={local.settings?.contentType || "movie"} onChange={(e) => patchSetting("contentType", e.target.value)} /></div>
              </>
            )}
            {(local.type === "trending" || local.type === "popular_week" || local.type === "most_viewed_today") && (
              <div><Label className="text-xs">Window (days)</Label><Input type="number" value={local.settings?.windowDays ?? 7} onChange={(e) => patchSetting("windowDays", Number(e.target.value))} /></div>
            )}
            {local.type === "trending" && (
              <div className="col-span-2 md:col-span-4">
                <Label className="text-xs">Weights (views / rating / likes / comments / watch)</Label>
                <div className="mt-1 grid grid-cols-5 gap-2">
                  {["views", "rating", "likes", "comments", "watch"].map((k) => (
                    <Input key={k} type="number" placeholder={k} value={local.settings?.weights?.[k] ?? 0}
                      onChange={(e) => patchSetting("weights", { ...(local.settings?.weights || {}), [k]: Number(e.target.value) })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {local.type === "hero" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><Label className="text-xs">Slides</Label><Input type="number" value={local.settings?.slides ?? 6} onChange={(e) => patchSetting("slides", Number(e.target.value))} /></div>
            <div><Label className="text-xs">Interval (ms)</Label><Input type="number" value={local.settings?.intervalMs ?? 7000} onChange={(e) => patchSetting("intervalMs", Number(e.target.value))} /></div>
            <div><Label className="text-xs">Transition (ms)</Label><Input type="number" value={local.settings?.transitionMs ?? 900} onChange={(e) => patchSetting("transitionMs", Number(e.target.value))} /></div>
            <div><Label className="text-xs">Height (vh)</Label><Input type="number" value={local.settings?.heightVh ?? 92} onChange={(e) => patchSetting("heightVh", Number(e.target.value))} /></div>
            <div><Label className="text-xs">Overlay opacity</Label><Input type="number" step="0.05" value={local.settings?.overlayOpacity ?? 0.55} onChange={(e) => patchSetting("overlayOpacity", Number(e.target.value))} /></div>
            <div><Label className="text-xs">Blur (px)</Label><Input type="number" value={local.settings?.blur ?? 0} onChange={(e) => patchSetting("blur", Number(e.target.value))} /></div>
            <div className="flex items-center gap-2 pt-5"><Switch checked={!!local.settings?.autoplay} onCheckedChange={(v) => patchSetting("autoplay", v)} /><span className="text-xs">Autoplay</span></div>
            <div className="flex items-center gap-2 pt-5"><Switch checked={local.settings?.autoSelect !== false} onCheckedChange={(v) => patchSetting("autoSelect", v)} /><span className="text-xs">Auto-select</span></div>
          </div>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CollectionsManager() {
  const [rows, setRows] = useState<Collection[]>([]);
  const load = async () => {
    const { data } = await (supabase as any).from("home_collections").select("*").order("sort_order");
    setRows((data as Collection[]) || []);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    const slug = prompt("Collection slug (unique)"); if (!slug) return;
    const { error } = await (supabase as any).from("home_collections").insert({ slug, title_i18n: { en: slug } });
    if (error) toast.error(error.message); else load();
  };
  const update = async (id: string, patch: any) => {
    await (supabase as any).from("home_collections").update(patch).eq("id", id); load();
  };
  const remove = async (id: string) => { await (supabase as any).from("home_collections").delete().eq("id", id); load(); };

  return (
    <div className="space-y-3">
      <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> New collection</Button>
      {rows.map((c) => (
        <Card key={c.id}><CardContent className="space-y-2 p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
            <Input placeholder="slug" value={c.slug} onChange={(e) => update(c.id, { slug: e.target.value })} />
            <Input placeholder="Title EN" value={c.title_i18n?.en || ""} onChange={(e) => update(c.id, { title_i18n: { ...c.title_i18n, en: e.target.value } })} />
            <Input placeholder="Banner URL" value={c.banner_url || ""} onChange={(e) => update(c.id, { banner_url: e.target.value })} />
            <Input placeholder="Logo URL" value={c.logo_url || ""} onChange={(e) => update(c.id, { logo_url: e.target.value })} />
            <Input placeholder="Theme color" value={c.theme_color || ""} onChange={(e) => update(c.id, { theme_color: e.target.value })} />
            <div className="flex items-center gap-2">
              <Switch checked={c.active} onCheckedChange={(v) => update(c.id, { active: v })} />
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <Textarea placeholder="Description EN" value={c.description_i18n?.en || ""} onChange={(e) => update(c.id, { description_i18n: { ...c.description_i18n, en: e.target.value } })} />
        </CardContent></Card>
      ))}
    </div>
  );
}

function FooterLinksManager() {
  const [rows, setRows] = useState<FooterLink[]>([]);
  const load = async () => {
    const { data } = await (supabase as any).from("home_footer_links").select("*").order("group_key").order("sort_order");
    setRows((data as FooterLink[]) || []);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    const { error } = await (supabase as any).from("home_footer_links").insert({ group_key: "genres", label_i18n: { en: "New" }, href: "/" });
    if (error) toast.error(error.message); else load();
  };
  const update = async (id: string, patch: any) => { await (supabase as any).from("home_footer_links").update(patch).eq("id", id); load(); };
  const remove = async (id: string) => { await (supabase as any).from("home_footer_links").delete().eq("id", id); load(); };

  return (
    <div className="space-y-2">
      <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" /> New link</Button>
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-1 gap-2 rounded border border-border p-3 md:grid-cols-6">
          <Input placeholder="group" value={r.group_key} onChange={(e) => update(r.id, { group_key: e.target.value })} />
          <Input placeholder="Label EN" value={r.label_i18n?.en || ""} onChange={(e) => update(r.id, { label_i18n: { ...r.label_i18n, en: e.target.value } })} />
          <Input placeholder="href" value={r.href} onChange={(e) => update(r.id, { href: e.target.value })} />
          <Input placeholder="icon" value={r.icon || ""} onChange={(e) => update(r.id, { icon: e.target.value })} />
          <Input type="number" placeholder="order" value={r.sort_order} onChange={(e) => update(r.id, { sort_order: Number(e.target.value) })} />
          <div className="flex items-center gap-2">
            <Switch checked={r.active} onCheckedChange={(v) => update(r.id, { active: v })} />
            <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminHomepageBuilder() {
  const { sections, loading, refetch } = useHomeLayout(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Homepage Builder</h1>
          <p className="text-sm text-muted-foreground">Compose the cinematic home experience. Changes sync live to visitors.</p>
        </div>
        <Button variant="outline" asChild className="gap-2"><a href="/" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Open Homepage</a></Button>
      </div>

      <Tabs defaultValue="sections">
        <TabsList>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="footer">Footer Links</TabsTrigger>
        </TabsList>
        <TabsContent value="sections" className="mt-4 space-y-4">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : sections.map((s) => (
            <SectionEditor key={s.id} section={s} onSaved={refetch} />
          ))}
        </TabsContent>
        <TabsContent value="collections" className="mt-4"><CollectionsManager /></TabsContent>
        <TabsContent value="footer" className="mt-4"><FooterLinksManager /></TabsContent>
      </Tabs>
    </div>
  );
}
