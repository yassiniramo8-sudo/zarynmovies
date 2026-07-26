import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { zarynConfirm } from "@/components/ZarynToast";
import { Plus, Trash2, Loader2, Shield } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type AppPermission = Database["public"]["Enums"]["app_permission"];

const ALL_PERMISSIONS: AppPermission[] = ["manage_movies", "manage_anime", "manage_articles", "manage_backgrounds", "moderate_comments", "manage_users"];

const ROLE_LABELS: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", moderator: "Moderator", user: "User" };

interface RoleEntry { id: string; user_id: string; role: AppRole; username?: string | null; }
interface PermEntry { id: string; user_id: string; permission: AppPermission; }

export default function AdminRoles() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [permissions, setPermissions] = useState<PermEntry[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; username: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin");
  const [selectedPerms, setSelectedPerms] = useState<AppPermission[]>([]);
  const [searchUser, setSearchUser] = useState("");

  const fetchData = async () => {
    const [rolesRes, permsRes, profilesRes] = await Promise.all([
      supabase.from("user_roles").select("*").neq("role", "user"),
      supabase.from("admin_permissions").select("*"),
      supabase.from("profiles").select("id, username"),
    ]);
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p.username]));
    const enrichedRoles = (rolesRes.data || []).map((r) => ({ ...r, username: profileMap.get(r.user_id) }));
    setRoles(enrichedRoles); setPermissions((permsRes.data as PermEntry[]) || []); setProfiles(profilesRes.data || []); setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getUserPerms = (userId: string) => permissions.filter((p) => p.user_id === userId).map((p) => p.permission);

  const openAddAdmin = () => { setSelectedUserId(""); setSelectedRole("admin"); setSelectedPerms([]); setSearchUser(""); setDialogOpen(true); };

  const handleAddAdmin = async () => {
    if (!selectedUserId) { toast.error("Select a user"); return; }
    const { error: roleErr } = await supabase.from("user_roles").update({ role: selectedRole }).eq("user_id", selectedUserId);
    if (roleErr) { toast.error(roleErr.message); return; }
    await supabase.from("admin_permissions").delete().eq("user_id", selectedUserId);
    if (selectedPerms.length > 0) {
      const inserts = selectedPerms.map((p) => ({ user_id: selectedUserId, permission: p, granted_by: user?.id }));
      const { error: permErr } = await supabase.from("admin_permissions").insert(inserts);
      if (permErr) { toast.error(permErr.message); return; }
    }
    toast.success("Role updated"); setDialogOpen(false); fetchData();
  };

  const handleRemoveAdmin = async (userId: string) => {
    zarynConfirm({
      title: "Demote User",
      message: "Demote this user back to regular user? All admin permissions will be removed.",
      type: "admin",
      confirmLabel: "Demote",
      onConfirm: async () => {
        await supabase.from("user_roles").update({ role: "user" as AppRole }).eq("user_id", userId);
        await supabase.from("admin_permissions").delete().eq("user_id", userId);
        toast.success("User demoted"); fetchData();
      },
    });
  };

  const filteredProfiles = profiles.filter((p) => p.username?.toLowerCase().includes(searchUser.toLowerCase()) || p.id.includes(searchUser));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-brand font-display">{t("admin.rolesPermissions")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.manageAccess")}</p>
        </div>
        <Button onClick={openAddAdmin} className="gradient-brand text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> {t("admin.addAdmin")}</Button>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">{t("admin.user")}</TableHead>
                <TableHead className="text-muted-foreground">{t("admin.role")}</TableHead>
                <TableHead className="text-muted-foreground">{t("admin.permissions")}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id} className="border-border/50">
                  <TableCell className="font-medium text-foreground">{r.username || r.user_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/30 text-primary text-xs"><Shield className="mr-1 h-3 w-3" /> {ROLE_LABELS[r.role] || r.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.role === "super_admin" ? <Badge className="text-xs bg-primary/20 text-primary">{t("admin.all")}</Badge> : getUserPerms(r.user_id).map((p) => <Badge key={p} variant="outline" className="text-xs border-border/50">{p.replace(/_/g, " ")}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.role !== "super_admin" && <Button variant="ghost" size="icon" onClick={() => handleRemoveAdmin(r.user_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader><DialogTitle>{t("admin.addAdmin")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-foreground">{t("admin.searchUser")}</Label>
              <Input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder={t("admin.searchUser")} className="border-border/50 bg-background/50" />
              {searchUser && (
                <div className="max-h-32 overflow-y-auto rounded border border-border/50 bg-background/50">
                  {filteredProfiles.slice(0, 10).map((p) => (
                    <button key={p.id} onClick={() => { setSelectedUserId(p.id); setSearchUser(p.username || p.id.slice(0, 8)); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${selectedUserId === p.id ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                      {p.username || p.id.slice(0, 8)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground">{t("admin.role")}</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger className="border-border/50 bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{t("admin.permissions")}</Label>
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox checked={selectedPerms.includes(p)} onCheckedChange={(checked) => setSelectedPerms(checked ? [...selectedPerms, p] : selectedPerms.filter((x) => x !== p))} />
                  <span className="capitalize">{p.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>

            <Button onClick={handleAddAdmin} className="w-full gradient-brand text-primary-foreground">{t("admin.save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
