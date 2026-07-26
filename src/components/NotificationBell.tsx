import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, X, Crown, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { zarynToast } from "@/components/ZarynToast";
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

export function NotificationBell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    const notifs = (data as Notification[]) || [];
    setNotifications(notifs);
    setUnreadCount(notifs.filter((n) => !n.read).length);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const unsub = realtimeManager.subscribe(`user-notifications-${user.id}`, {
      tables: [{ schema: "public", table: "notifications" }],
      filter: `user_id=eq.${user.id}`,
      onChange: () => {
        // Re-fetch to keep list in sync on any change
        fetchNotifications();
      },
    });
    return () => { unsub(); };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => { const updated = prev.filter((n) => n.id !== id); setUnreadCount(updated.filter((n) => !n.read).length); return updated; });
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]);
    setUnreadCount(0);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-background/50 z-50 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <h3 className="font-display text-sm font-semibold text-foreground">{t("notifications.title")}</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={markAllRead}>
                    <CheckCheck className="mr-1 h-3 w-3" /> {t("notifications.readAll")}
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={clearAll}>
                    <Trash2 className="mr-1 h-3 w-3" /> {t("notifications.clear")}
                  </Button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="mb-2 h-8 w-8 opacity-30" />
                  <p className="text-sm">{t("notifications.noNotifications")}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`group flex items-start gap-3 border-b border-border/20 px-4 py-3 transition-colors hover:bg-accent/30 ${!n.read ? "bg-primary/5" : ""} ${isVipNotif(n) ? "border-l-2 border-l-amber-400/60" : ""}`}>
                    {n.image_url ? <img src={n.image_url} alt="" className="mt-0.5 h-10 w-8 shrink-0 rounded-md object-cover" /> : (
                      <div className={`mt-0.5 flex h-10 w-8 shrink-0 items-center justify-center rounded-md ${isVipNotif(n) ? "bg-gradient-to-br from-amber-500/20 to-yellow-400/20" : "bg-primary/10"}`}>
                        {getNotifIcon(n)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link to={n.link} onClick={() => { markAsRead(n.id); setOpen(false); }} className="block">
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
                      {!n.read && <button onClick={() => markAsRead(n.id)} className="rounded p-1 text-muted-foreground hover:text-primary transition-colors" title={t("notifications.readAll")}><Check className="h-3.5 w-3.5" /></button>}
                      <button onClick={() => deleteNotification(n.id)} className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors" title={t("admin.delete")}><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-border/30 px-4 py-2">
                <Link to="/profile" onClick={() => setOpen(false)} className="block text-center text-xs text-primary hover:underline">
                  {t("notifications.viewAllProfile")}
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
