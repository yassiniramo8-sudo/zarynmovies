import {
  LayoutDashboard, Film, Tv, FileText, Image, Users, MessageSquare, Shield, Settings, Paintbrush,
  Crown, Wallet, Clock, Star, Receipt, Languages, Mail, Gift, Send, UserX, Sparkles, PenTool, Megaphone, MapPin, Bot, FolderOpen,
  Newspaper, Vote, Scale, BellRing, Radar, Key, Layers, SlidersHorizontal,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isSuperAdmin, hasPermission } = useRoles();
  const { t } = useLanguage();

  const allItems = [
    { title: t("admin.overview"), url: "/admin", icon: LayoutDashboard, perm: null },
    { title: "Homepage Builder", url: "/admin/homepage", icon: LayoutDashboard, perm: null, superOnly: true },
    { title: t("admin.movies"), url: "/admin/movies", icon: Film, perm: "manage_movies" },
    { title: t("admin.anime"), url: "/admin/anime", icon: Tv, perm: "manage_anime" },
    { title: t("admin.series"), url: "/admin/series", icon: Tv, perm: "manage_movies" },
    { title: t("admin.articles"), url: "/admin/articles", icon: FileText, perm: "manage_articles" },
    { title: "Summaries", url: "/admin/highlights", icon: Film, perm: null },
    { title: "News", url: "/admin/sports-news", icon: Newspaper, perm: null, superOnly: true },
    { title: "Polls", url: "/admin/polls", icon: Vote, perm: null, superOnly: true },
    { title: t("admin.users"), url: "/admin/users", icon: Users, perm: "manage_users" },
    { title: t("admin.comments"), url: "/admin/comments", icon: MessageSquare, perm: "moderate_comments" },
    { title: t("admin.roles"), url: "/admin/roles", icon: Shield, perm: null, superOnly: true },
    { title: t("admin.settings"), url: "/admin/settings", icon: Settings, perm: null },
    { title: "Appearance", url: "/admin/appearance", icon: Paintbrush, perm: null, superOnly: true },
    { title: "Sub Plans", url: "/admin/subscription-plans", icon: Crown, perm: null, superOnly: true },
    { title: "Payment Methods", url: "/admin/payment-methods", icon: Wallet, perm: null, superOnly: true },
    { title: "Sub Requests", url: "/admin/subscription-requests", icon: Clock, perm: null, superOnly: true },
    { title: "VIP Members", url: "/admin/vip-members", icon: Star, perm: null, superOnly: true },
    { title: "Payments", url: "/admin/payments", icon: Receipt, perm: null, superOnly: true },
    { title: "Translations", url: "/admin/translations", icon: Languages, perm: null, superOnly: true },
    { title: "Messages", url: "/admin/messages", icon: Mail, perm: null, superOnly: true },
    { title: "Email Campaigns", url: "/admin/email-campaigns", icon: Send, perm: null, superOnly: true },
    { title: "Expired Users", url: "/admin/expired-users", icon: UserX, perm: null, superOnly: true },
    { title: "AI Movie Manager", url: "/admin/ai-movies", icon: Sparkles, perm: "manage_movies" },
    { title: "AI Article Writer", url: "/admin/ai-articles", icon: PenTool, perm: "manage_articles" },
    { title: "Advertisements", url: "/admin/advertisements", icon: Megaphone, perm: null, superOnly: true },
    { title: "Sitemap", url: "/admin/sitemap", icon: MapPin, perm: null, superOnly: true },
    { title: "AI Assistant", url: "/admin/ai-chat", icon: Bot, perm: null, superOnly: true },
    { title: "Anime Groups", url: "/admin/anime-groups", icon: FolderOpen, perm: "manage_anime" },
    { title: "Legal Pages", url: "/admin/legal-pages", icon: Scale, perm: null, superOnly: true },
    { title: "Notification Control", url: "/admin/notification-control", icon: BellRing, perm: null, superOnly: true },
    { title: "Content Scanner", url: "/admin/content-scanner", icon: Radar, perm: null, superOnly: true },
    { title: "RSS Aggregator", url: "/admin/news-aggregator", icon: Newspaper, perm: null, superOnly: true },
    { title: "API Keys", url: "/admin/api-keys", icon: Key, perm: null, superOnly: true },
    { title: "AI Translate", url: "/admin/ai-translate", icon: Languages, perm: null, superOnly: true },
    { title: "Pagination", url: "/admin/pagination-settings", icon: SlidersHorizontal, perm: null },
    { title: "Page Manager", url: "/admin/pages", icon: Layers, perm: null, superOnly: true },
  ];

  const items = allItems.filter((item: any) => {
    if (item.superOnly) return isSuperAdmin;
    if (!item.perm) return true;
    return hasPermission(item.perm);
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("admin.management")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/admin"} className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
