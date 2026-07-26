import { useMemo, useState } from "react";
import { usePageSettings, PageSetting, PageStatus } from "@/hooks/usePageSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Eye, EyeOff, Wrench, Lock,
  Copy, ExternalLink, Loader2,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  main: { label: "Main Navigation", emoji: "🏠" },
  content: { label: "Content Pages", emoji: "🎬" },
  categories: { label: "Category Pages", emoji: "📂" },
  user: { label: "User Pages", emoji: "👤" },
  vip: { label: "Subscription & VIP", emoji: "💳" },
  system: { label: "System Pages", emoji: "⚙️" },
  homepage: { label: "Homepage Sections", emoji: "📰" },
  admin: { label: "Admin", emoji: "🛡️" },
};

const STATUS_META: Record<PageStatus, { label: string; className: string; icon: any }> = {
  visible:      { label: "Visible",       className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: Eye },
  hidden:       { label: "Hidden",        className: "bg-rose-500/15 text-rose-500 border-rose-500/30",           icon: EyeOff },
  maintenance:  { label: "Maintenance",   className: "bg-amber-500/15 text-amber-500 border-amber-500/30",        icon: Wrench },
  admin_only:   { label: "Admin Only",    className: "bg-sky-500/15 text-sky-500 border-sky-500/30",              icon: Lock },
};

export default function AdminPageManager() {
  const { rows, loading, update } = usePageSettings();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const g: Record<string, PageSetting[]> = {};
    rows.forEach((r) => {
      const cat = r.category || "system";
      (g[cat] ||= []).push(r);
    });
    Object.values(g).forEach((arr) => arr.sort((a, b) => a.sort_order - b.sort_order));
    return g;
  }, [rows]);

  const categoryKeys = useMemo(() => {
    const preferred = ["main", "content", "categories", "user", "vip", "homepage", "system", "admin"];
    const present = Object.keys(grouped);
    return [...preferred.filter((k) => present.includes(k)), ...present.filter((k) => !preferred.includes(k))];
  }, [grouped]);

  const setStatus = async (row: PageSetting, status: PageStatus) => {
    try {
      await update(row.id, { status });
      toast.success(`${row.label}${STATUS_META[status].label}`);
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  };

  const toggleField = async (row: PageSetting, field: "show_in_nav" | "show_in_footer" | "show_in_sidebar", val: boolean) => {
    try {
      await update(row.id, { [field]: val } as any);
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  };

  const expandAll = () => setCollapsed({});
  const collapseAll = () => setCollapsed(Object.fromEntries(categoryKeys.map((k) => [k, true])));

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Page Manager</h1>
          <p className="text-sm text-muted-foreground">
            Real-time control over every page's visibility, menu placement, and access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>Expand all</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Collapse all</Button>
        </div>
      </div>

      <div className="space-y-4">
        {categoryKeys.map((cat) => {
          const meta = CATEGORY_META[cat] ?? { label: cat, emoji: "📄" };
          const isCollapsed = collapsed[cat];
          const items = grouped[cat] || [];
          return (
            <Card key={cat} className="overflow-hidden">
              <button
                onClick={() => setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))}
                className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-4 py-3 text-left hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="text-lg">{meta.emoji}</span>
                  <span className="font-semibold">{meta.label}</span>
                  <Badge variant="secondary" className="ml-1">{items.length}</Badge>
                </div>
              </button>
              {!isCollapsed && (
                <div className="divide-y divide-border/40">
                  {items.map((row) => (
                    <PageRow
                      key={row.id}
                      row={row}
                      onStatus={(s) => setStatus(row, s)}
                      onToggle={(f, v) => toggleField(row, f, v)}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PageRow({
  row, onStatus, onToggle,
}: {
  row: PageSetting;
  onStatus: (s: PageStatus) => void;
  onToggle: (f: "show_in_nav" | "show_in_footer" | "show_in_sidebar", v: boolean) => void;
}) {
  const s = STATUS_META[row.status];
  const StatusIcon = s.icon;

  return (
    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1.5fr)_auto_auto_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{row.label}</p>
          {row.is_system && <Badge variant="outline" className="text-[10px]">System</Badge>}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5">{row.route_key}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + row.route_key);
              toast.success("Route copied");
            }}
            className="inline-flex items-center gap-1 hover:text-foreground"
            title="Copy URL"
          >
            <Copy className="h-3 w-3" />
          </button>
          <a
            href={row.route_key}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
            title="Open page"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${s.className}`}>
        <StatusIcon className="h-3 w-3" />
        {s.label}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="inline-flex items-center gap-1.5">
          <Switch checked={row.show_in_nav} onCheckedChange={(v) => onToggle("show_in_nav", v)} />
          <span>Nav</span>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <Switch checked={row.show_in_footer} onCheckedChange={(v) => onToggle("show_in_footer", v)} />
          <span>Footer</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Select value={row.status} onValueChange={(v) => onStatus(v as PageStatus)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="visible"><span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Visible</span></SelectItem>
            <SelectItem value="hidden"><span className="inline-flex items-center gap-2"><EyeOff className="h-3.5 w-3.5" /> Hidden</span></SelectItem>
            <SelectItem value="maintenance"><span className="inline-flex items-center gap-2"><Wrench className="h-3.5 w-3.5" /> Maintenance</span></SelectItem>
            <SelectItem value="admin_only"><span className="inline-flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Admin Only</span></SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
