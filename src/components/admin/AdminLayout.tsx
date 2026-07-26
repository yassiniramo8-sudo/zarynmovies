import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRoles } from "@/hooks/useRoles";
import { AdminSidebar } from "./AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2 } from "lucide-react";

export function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isModerator, loading: rolesLoading } = useRoles();
  const { t } = useLanguage();

  if (authLoading || rolesLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isModerator) return <Navigate to="/" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-[calc(100vh-4rem)] flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-16 z-30 h-12 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm px-3 sm:px-4">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-muted-foreground truncate">
                {t("admin.dashboard")}
              </span>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 p-3 sm:p-4 lg:p-6 min-w-0 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
