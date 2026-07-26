import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Poll {
  id: string;
  question: string;
  question_ar: string | null;
  options: { label: string; label_ar?: string }[];
  category: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

const CATEGORIES = ["Best Player", "Best Goal", "Match of the Week", "Transfer Rumor", "General"];

export default function AdminPolls() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const [form, setForm] = useState<{
    question: string; question_ar: string;
    options: { label: string; label_ar: string }[];
    category: string; status: string; expires_at: string;
  }>({
    question: "", question_ar: "",
    options: [{ label: "", label_ar: "" }, { label: "", label_ar: "" }],
    category: "General", status: "active", expires_at: "",
  });

  const fetchPolls = async () => {
    const { data } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
    setPolls(((data as any[]) || []).map(p => ({ ...p, options: typeof p.options === 'string' ? JSON.parse(p.options) : p.options })));
  };

  useEffect(() => { fetchPolls(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ question: "", question_ar: "", options: [{ label: "", label_ar: "" }, { label: "", label_ar: "" }] as { label: string; label_ar: string }[], category: "General", status: "active", expires_at: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Poll) => {
    setEditing(p);
    setForm({
      question: p.question, question_ar: p.question_ar || "",
      options: (p.options.length >= 2 ? p.options : [...p.options, { label: "", label_ar: "" }]).map(o => ({ label: o.label, label_ar: o.label_ar || "" })),
      category: p.category || "General", status: p.status, expires_at: p.expires_at?.split("T")[0] || "",
    });
    setDialogOpen(true);
  };

  const addOption = () => setForm({ ...form, options: [...form.options, { label: "", label_ar: "" }] });
  const removeOption = (i: number) => setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) });
  const updateOption = (i: number, field: string, value: string) => {
    const opts = [...form.options];
    (opts[i] as any)[field] = value;
    setForm({ ...form, options: opts });
  };

  const handleSave = async () => {
    if (!form.question.trim()) { toast.error("Question is required"); return; }
    if (form.options.filter(o => o.label.trim()).length < 2) { toast.error("At least 2 options required"); return; }
    setLoading(true);

    const payload = {
      question: form.question.trim(),
      question_ar: form.question_ar.trim() || null,
      options: form.options.filter(o => o.label.trim()),
      category: form.category,
      status: form.status,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      await supabase.from("polls").update(payload).eq("id", editing.id);
      toast.success("Poll updated");
    } else {
      await supabase.from("polls").insert({ ...payload, created_by: user?.id });
      toast.success("Poll created");
    }

    setDialogOpen(false);
    setLoading(false);
    fetchPolls();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this poll?")) return;
    await supabase.from("polls").delete().eq("id", id);
    toast.success("Deleted");
    fetchPolls();
  };

  const toggleStatus = async (p: Poll) => {
    const newStatus = p.status === "active" ? "closed" : "active";
    await supabase.from("polls").update({ status: newStatus }).eq("id", p.id);
    fetchPolls();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polls Management</h1>
          <p className="text-sm text-muted-foreground">{polls.length} polls</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Poll</Button>
      </div>

      <div className="space-y-3">
        {polls.map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{p.question}</p>
              {p.question_ar && <p className="text-xs text-muted-foreground" dir="rtl">{p.question_ar}</p>}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                {p.category && <Badge variant="outline">{p.category}</Badge>}
                <span className="text-xs text-muted-foreground">{p.options.length} options</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => toggleStatus(p)}>
                {p.status === "active" ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {polls.length === 0 && <p className="py-10 text-center text-muted-foreground">No polls yet.</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Poll" : "New Poll"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Question (English) *</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Question (Arabic)</Label>
              <Input value={form.question_ar} onChange={(e) => setForm({ ...form, question_ar: e.target.value })} dir="rtl" />
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              {form.options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input placeholder={`Option ${i + 1}`} value={opt.label} onChange={(e) => updateOption(i, "label", e.target.value)} className="flex-1" />
                  <Input placeholder="Arabic" value={opt.label_ar || ""} onChange={(e) => updateOption(i, "label_ar", e.target.value)} className="flex-1" dir="rtl" />
                  {form.options.length > 2 && (
                    <Button size="icon" variant="ghost" onClick={() => removeOption(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
              ))}
              {form.options.length < 6 && (
                <Button variant="outline" size="sm" onClick={addOption}><Plus className="mr-1 h-3 w-3" /> Add Option</Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expires At</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
