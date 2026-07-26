import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Trash2, X, Crown, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const isVipNotif = (n: { title: string }) =>
  /vip|crown|👑|🎉|lifetime/i.test(n.title);

const getNotifIcon = (n: { title: string }) => {
  if (isVipNotif(n)) return <Crown className="h-4 w-4 text-amber-400" />;
  if (/admin|moderator|role/i.test(n.title)) return <Shield className="h-4 w-4 text-primary" />;
  return <Bell className="h-4 w-4 text-primary" />;
};

interface Notification {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  image_url: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = realtimeManager.subscribe(`profile-notifications-${user.id}`, {
      tables: [{ schema: "public", table: "notifications" }],
      filter: `user_id=eq.${user.id}`,
      onChange: () => fetchAll(),
    });
    return () => { unsub(); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
  };

  if (!user) return null;
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/20">
        <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> {t("notifications.title")}
          {unread > 0 && <Badge variant="outline" className="text-xs border-primary/30 text-primary">{unread} {t("notifications.new")}</Badge>}
        </h3>
        <div className="flex gap-1">
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-3 w-3" /> {t("notifications.readAll")}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={clearAll}>
              <Trash2 className="mr-1 h-3 w-3" /> {t("notifications.clearAll")}
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("profile.loading")}</p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">{t("notifications.noNotifications")}</p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((n) => (
               <motion.div key={n.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className={`group flex items-start gap-3 border-b border-border/20 px-4 py-3 transition-colors hover:bg-accent/30 ${!n.read ? "bg-primary/5" : ""} ${isVipNotif(n) ? "border-l-2 border-l-amber-400/60" : ""}`}>
                {n.image_url ? <img src={n.image_url} alt="" className="mt-0.5 h-10 w-8 shrink-0 rounded-md object-cover" /> : (
                  <div className={`mt-0.5 flex h-10 w-8 shrink-0 items-center justify-center rounded-md ${isVipNotif(n) ? "bg-gradient-to-br from-amber-500/20 to-yellow-400/20" : "bg-primary/10"}`}>{getNotifIcon(n)}</div>
                )}
                <div className="flex-1 min-w-0">
                  {n.link ? (
                    <Link to={n.link} className="block" onClick={() => markAsRead(n.id)}>
                      <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>}
                    </Link>
                  ) : (
                    <>
                      <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>}
                    </>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/60">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!n.read && <button onClick={() => markAsRead(n.id)} className="rounded p-1 text-muted-foreground hover:text-primary transition-colors"><Check className="h-3.5 w-3.5" /></button>}
                  <button onClick={() => deleteOne(n.id)} className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"><X className="h-3.5 w-3.5" /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
