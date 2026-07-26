import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Bell, BellOff, Search, User, Clock, AlertTriangle } from "lucide-react";

export default function AdminNotificationControl() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Fetch all profiles with their notification settings
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-notification-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .order("username");
      if (error) throw error;

      const { data: settings } = await supabase
        .from("user_notification_settings")
        .select("*");

      const { data: notifCounts } = await supabase
        .from("notifications")
        .select("user_id, id");

      const countMap: Record<string, number> = {};
      notifCounts?.forEach(n => {
        countMap[n.user_id] = (countMap[n.user_id] || 0) + 1;
      });

      const settingsMap: Record<string, any> = {};
      settings?.forEach(s => { settingsMap[s.user_id] = s; });

      return (profiles || []).map(p => ({
        ...p,
        notification_settings: settingsMap[p.id] || null,
        notification_count: countMap[p.id] || 0,
      }));
    },
  });

  const togglePause = useMutation({
    mutationFn: async ({ userId, paused }: { userId: string; paused: boolean }) => {
      const { data: existing } = await supabase
        .from("user_notification_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_notification_settings")
          .update({ notifications_paused: paused, updated_at: new Date().toISOString() } as any)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_notification_settings")
          .insert({ user_id: userId, notifications_paused: paused } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-users"] });
      toast.success("Notification settings updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filteredUsers = users?.filter(u =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const pausedCount = users?.filter(u => u.notification_settings?.notifications_paused).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient-brand font-display">Notification Control</h1>
        <p className="text-muted-foreground mt-1">Manage user notification settings and view notification logs</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <Bell className="mx-auto h-6 w-6 text-primary mb-2" />
            <p className="text-2xl font-bold">{users?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <BellOff className="mx-auto h-6 w-6 text-destructive mb-2" />
            <p className="text-2xl font-bold">{pausedCount}</p>
            <p className="text-xs text-muted-foreground">Notifications Paused</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-500 mb-2" />
            <p className="text-2xl font-bold">{users?.reduce((s, u) => s + u.notification_count, 0) || 0}</p>
            <p className="text-xs text-muted-foreground">Total Notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* User list */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">User Notifications</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">Notifications</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Pause</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                )}
                {filteredUsers?.map(user => {
                  const isPaused = user.notification_settings?.notifications_paused || false;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-sm font-medium">{user.username || "No name"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{user.notification_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isPaused ? (
                          <Badge variant="destructive" className="gap-1">
                            <BellOff className="h-3 w-3" /> Paused
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-primary gap-1">
                            <Bell className="h-3 w-3" /> Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isPaused}
                          onCheckedChange={(checked) => togglePause.mutate({ userId: user.id, paused: checked })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && !filteredUsers?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No users found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
