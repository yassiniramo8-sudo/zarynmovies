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
import { Plus, Edit2, Trash2, Loader2, Wallet } from "lucide-react";

interface PaymentMethod {
  id: string; name: string; instructions: string | null; wallet_info: string | null;
  qr_image_url: string | null; active: boolean; sort_order: number;
}

export default function AdminPaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState({ name: "", instructions: "", wallet_info: "", qr_image_url: "", active: true });
  const [uploading, setUploading] = useState(false);

  const fetchMethods = async () => {
    const { data } = await supabase.from("payment_methods").select("*").order("sort_order");
    setMethods(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMethods(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", instructions: "", wallet_info: "", qr_image_url: "", active: true });
    setDialogOpen(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({ name: m.name, instructions: m.instructions || "", wallet_info: m.wallet_info || "", qr_image_url: m.qr_image_url || "", active: m.active });
    setDialogOpen(true);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `payment-qr/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("content").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("content").getPublicUrl(path);
    setForm(f => ({ ...f, qr_image_url: publicUrl }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      instructions: form.instructions.trim() || null,
      wallet_info: form.wallet_info.trim() || null,
      qr_image_url: form.qr_image_url.trim() || null,
      active: form.active,
    };
    if (editing) {
      const { error } = await supabase.from("payment_methods").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Updated");
    } else {
      const { error } = await supabase.from("payment_methods").insert(payload);
      if (error) toast.error(error.message); else toast.success("Created");
    }
    setDialogOpen(false);
    fetchMethods();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchMethods(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display flex items-center gap-2"><Wallet className="h-7 w-7" /> Payment Methods</h1>
          <p className="text-muted-foreground mt-1">{methods.length} methods</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> New Method</Button>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Wallet/Info</TableHead>
                <TableHead className="text-muted-foreground">QR</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((m) => (
                <TableRow key={m.id} className="border-border/50">
                  <TableCell className="font-medium text-foreground">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{m.wallet_info || "—"}</TableCell>
                  <TableCell>{m.qr_image_url ? <img src={m.qr_image_url} alt="QR" className="h-8 w-8 rounded object-cover" /> : "—"}</TableCell>
                  <TableCell><Badge variant={m.active ? "default" : "secondary"} className="text-xs">{m.active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {methods.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payment methods yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Payment Method</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Method Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="PayPal, Crypto, etc." className="border-border/50 bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Wallet / Email / Number</Label>
              <Input value={form.wallet_info} onChange={(e) => setForm({ ...form, wallet_info: e.target.value })} placeholder="your-wallet@example.com" className="border-border/50 bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Instructions</Label>
              <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Send payment to..." className="border-border/50 bg-background/50" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>QR Code Image</Label>
              <div className="flex items-center gap-3">
                {form.qr_image_url && <img src={form.qr_image_url} alt="QR" className="h-16 w-16 rounded-lg object-cover border border-border/50" />}
                <Input type="file" accept="image/*" onChange={handleQrUpload} disabled={uploading} className="border-border/50 bg-background/50" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Active</Label>
            </div>
            <Button onClick={handleSave} className="w-full gradient-brand text-primary-foreground">{editing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
