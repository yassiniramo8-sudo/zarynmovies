import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Loader2, Crown, GripVertical, CheckCircle2, Star, Shield, Zap, Gift, Eye, Ban, Sparkles, Heart, Award, Gem, Save, ArrowUpDown } from "lucide-react";

const ICON_OPTIONS = [
  { name: "CheckCircle2", icon: CheckCircle2 },
  { name: "Star", icon: Star },
  { name: "Shield", icon: Shield },
  { name: "Zap", icon: Zap },
  { name: "Gift", icon: Gift },
  { name: "Eye", icon: Eye },
  { name: "Ban", icon: Ban },
  { name: "Crown", icon: Crown },
  { name: "Sparkles", icon: Sparkles },
  { name: "Heart", icon: Heart },
  { name: "Award", icon: Award },
  { name: "Gem", icon: Gem },
];

const COLOR_PRESETS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#f97316",
];

export interface PlanFeature {
  id: string;
  text: string;
  icon: string;
  color: string;
}

interface Plan {
  id: string; name: string; duration_days: number; price: number; currency: string;
  description: string | null; active: boolean; sort_order: number; features: PlanFeature[];
}

export default function AdminSubscriptionPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: "", duration_days: "30", price: "0", currency: "USD", description: "", active: true });
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [featuresDialogOpen, setFeaturesDialogOpen] = useState(false);
  const [featuresPlan, setFeaturesPlan] = useState<Plan | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Plan ordering state
  const [orderMode, setOrderMode] = useState(false);
  const [orderedPlans, setOrderedPlans] = useState<Plan[]>([]);
  const [planDragIdx, setPlanDragIdx] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchPlans = async () => {
    const { data } = await supabase.from("subscription_plans").select("*").order("sort_order");
    const parsed = (data || []).map((p: any) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features : [],
    }));
    setPlans(parsed);
    setOrderedPlans(parsed);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", duration_days: "30", price: "0", currency: "USD", description: "", active: true });
    setDialogOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({ name: p.name, duration_days: String(p.duration_days), price: String(p.price), currency: p.currency, description: p.description || "", active: p.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      duration_days: parseInt(form.duration_days) || 30,
      price: parseFloat(form.price) || 0,
      currency: form.currency.trim() || "USD",
      description: form.description.trim() || null,
      active: form.active,
    };
    if (editing) {
      const { error } = await supabase.from("subscription_plans").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Plan updated");
    } else {
      const { error } = await supabase.from("subscription_plans").insert(payload);
      if (error) toast.error(error.message); else toast.success("Plan created");
    }
    setDialogOpen(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Plan deleted"); fetchPlans(); }
  };

  // --- Features Management ---
  const openFeatures = (p: Plan) => {
    setFeaturesPlan(p);
    setFeatures(p.features.length > 0 ? [...p.features] : [
      { id: crypto.randomUUID(), text: "Ad-free browsing", icon: "CheckCircle2", color: "#22c55e" },
      { id: crypto.randomUUID(), text: "No AdBlock restrictions", icon: "CheckCircle2", color: "#22c55e" },
      { id: crypto.randomUUID(), text: "VIP badge on profile", icon: "CheckCircle2", color: "#22c55e" },
      { id: crypto.randomUUID(), text: "VIP badge in comments", icon: "CheckCircle2", color: "#22c55e" },
    ]);
    setFeaturesDialogOpen(true);
  };

  const addFeature = () => {
    setFeatures([...features, { id: crypto.randomUUID(), text: "", icon: "CheckCircle2", color: "#22c55e" }]);
  };

  const updateFeature = (id: string, field: keyof PlanFeature, value: string) => {
    setFeatures(features.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeFeature = (id: string) => {
    setFeatures(features.filter(f => f.id !== id));
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const updated = [...features];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setFeatures(updated);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const saveFeatures = async () => {
    if (!featuresPlan) return;
    const cleanFeatures = features.filter(f => f.text.trim());
    const { error } = await supabase.from("subscription_plans").update({ features: cleanFeatures as any, updated_at: new Date().toISOString() }).eq("id", featuresPlan.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Features saved");
    setFeaturesDialogOpen(false);
    fetchPlans();
  };

  const getIconComponent = (name: string) => {
    return ICON_OPTIONS.find(i => i.name === name)?.icon || CheckCircle2;
  };

  // --- Plan Ordering ---
  const enterOrderMode = () => {
    setOrderedPlans([...plans]);
    setOrderMode(true);
  };

  const handlePlanDragStart = (idx: number) => setPlanDragIdx(idx);
  const handlePlanDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (planDragIdx === null || planDragIdx === idx) return;
    const updated = [...orderedPlans];
    const [moved] = updated.splice(planDragIdx, 1);
    updated.splice(idx, 0, moved);
    setOrderedPlans(updated);
    setPlanDragIdx(idx);
  };
  const handlePlanDragEnd = () => setPlanDragIdx(null);

  const saveOrder = async () => {
    setSavingOrder(true);
    const updates = orderedPlans.map((p, i) =>
      supabase.from("subscription_plans").update({ sort_order: i, updated_at: new Date().toISOString() }).eq("id", p.id)
    );
    const results = await Promise.all(updates);
    const failed = results.find(r => r.error);
    if (failed?.error) { toast.error(failed.error.message); }
    else { toast.success("Plan order saved"); }
    setSavingOrder(false);
    setOrderMode(false);
    fetchPlans();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const displayPlans = orderMode ? orderedPlans : plans;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2"><Crown className="h-7 w-7" /> Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">{plans.length} plans</p>
        </div>
        <div className="flex items-center gap-2">
          {orderMode ? (
            <>
              <Button variant="outline" onClick={() => setOrderMode(false)} className="border-border/50">Cancel</Button>
              <Button onClick={saveOrder} disabled={savingOrder} className="gradient-brand text-primary-foreground">
                {savingOrder ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Save Order
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={enterOrderMode} className="border-border/50">
                <ArrowUpDown className="mr-1 h-4 w-4" /> Reorder
              </Button>
              <Button onClick={openCreate} className="gradient-brand text-primary-foreground">
                <Plus className="mr-1 h-4 w-4" /> New Plan
              </Button>
            </>
          )}
        </div>
      </div>

      {orderMode && (
        <p className="text-sm text-muted-foreground bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
          Drag and drop plans to reorder them. The order will be reflected on the subscription page for all users.
        </p>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          {orderMode ? (
            <div className="divide-y divide-border/50">
              {displayPlans.map((p, idx) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => handlePlanDragStart(idx)}
                  onDragOver={(e) => handlePlanDragOver(e, idx)}
                  onDragEnd={handlePlanDragEnd}
                  className={`flex items-center gap-4 px-4 py-3 transition-all cursor-grab active:cursor-grabbing ${
                    planDragIdx === idx ? "bg-primary/10 opacity-70" : "hover:bg-muted/30"
                  }`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-mono text-muted-foreground w-6 text-center">{idx + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.duration_days} days — {p.price} {p.currency}</p>
                  </div>
                  <Badge variant={p.active ? "default" : "secondary"} className="text-xs">
                    {p.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-muted-foreground w-12">#</TableHead>
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Duration</TableHead>
                  <TableHead className="text-muted-foreground">Price</TableHead>
                  <TableHead className="text-muted-foreground">Features</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPlans.map((p, idx) => (
                  <TableRow key={p.id} className="border-border/50">
                    <TableCell className="text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.duration_days} days</TableCell>
                    <TableCell className="text-foreground">{p.price} {p.currency}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openFeatures(p)} className="text-xs border-border/50">
                        <Sparkles className="mr-1 h-3 w-3" /> {p.features.length} features
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"} className="text-xs">
                        {p.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {displayPlans.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No plans yet. Create your first subscription plan.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Plan Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Plan" : "New Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Plan Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VIP 30 Days" className="border-border/50 bg-background/50" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Duration (days)</Label>
                <Input type="number" min="1" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className="border-border/50 bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border-border/50 bg-background/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" className="border-border/50 bg-background/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Benefits of this plan..." className="border-border/50 bg-background/50" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Active</Label>
            </div>
            <Button onClick={handleSave} className="w-full gradient-brand text-primary-foreground">{editing ? "Update" : "Create"} Plan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Features Management Dialog */}
      <Dialog open={featuresDialogOpen} onOpenChange={setFeaturesDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Manage Features — {featuresPlan?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Feature List */}
            <div className="space-y-2">
              {features.map((f, idx) => {
                const IconComp = getIconComponent(f.icon);
                return (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 rounded-lg border p-3 transition-all ${
                      dragIdx === idx ? "border-primary bg-primary/10 opacity-70" : "border-border/50 bg-background/30"
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                    
                    {/* Icon Selector */}
                    <div className="relative group shrink-0">
                      <button className="p-1.5 rounded-md border border-border/50 hover:border-primary/50 transition-colors">
                        <IconComp className="h-4 w-4" style={{ color: f.color }} />
                      </button>
                      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:grid grid-cols-4 gap-1 p-2 rounded-lg border border-border/50 bg-card shadow-lg min-w-[160px]">
                        {ICON_OPTIONS.map(opt => {
                          const OptIcon = opt.icon;
                          return (
                            <button
                              key={opt.name}
                              onClick={() => updateFeature(f.id, "icon", opt.name)}
                              className={`p-1.5 rounded hover:bg-accent transition-colors ${f.icon === opt.name ? "bg-primary/20" : ""}`}
                              title={opt.name}
                            >
                              <OptIcon className="h-4 w-4" style={{ color: f.color }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Color Selector */}
                    <div className="relative group shrink-0">
                      <button className="h-7 w-7 rounded-full border-2 border-border/50 hover:border-primary/50 transition-colors" style={{ backgroundColor: f.color }} />
                      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:flex gap-1 p-2 rounded-lg border border-border/50 bg-card shadow-lg">
                        {COLOR_PRESETS.map(c => (
                          <button
                            key={c}
                            onClick={() => updateFeature(f.id, "color", c)}
                            className={`h-6 w-6 rounded-full border-2 transition-all ${f.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-110"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          value={f.color}
                          onChange={(e) => updateFeature(f.id, "color", e.target.value)}
                          className="h-6 w-6 rounded-full cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>

                    {/* Text */}
                    <Input
                      value={f.text}
                      onChange={(e) => updateFeature(f.id, "text", e.target.value)}
                      placeholder="Feature text..."
                      className="flex-1 border-border/50 bg-background/50 h-8 text-sm"
                    />

                    <Button variant="ghost" size="sm" onClick={() => removeFeature(f.id)} className="text-destructive shrink-0 h-8 w-8 p-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Button variant="outline" onClick={addFeature} className="w-full border-dashed border-border/50">
              <Plus className="mr-1 h-4 w-4" /> Add Feature
            </Button>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Preview</Label>
              <div className="rounded-lg border border-border/50 bg-background/30 p-4">
                <ul className="space-y-2">
                  {features.filter(f => f.text.trim()).map(f => {
                    const IconComp = getIconComponent(f.icon);
                    return (
                      <li key={f.id} className="flex items-center gap-2 text-sm text-foreground">
                        <IconComp className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                        {f.text}
                      </li>
                    );
                  })}
                </ul>
                {features.filter(f => f.text.trim()).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center">No features added yet</p>
                )}
              </div>
            </div>

            <Button onClick={saveFeatures} className="w-full gradient-brand text-primary-foreground">
              Save Features
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
