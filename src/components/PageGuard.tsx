import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { usePageSettings, resolveRouteStatus } from "@/hooks/usePageSettings";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Wrench, Lock, EyeOff } from "lucide-react";

/**
 * Enforces database-driven page visibility.
 * Wrap around <Routes> so every navigation is gated.
 */
export function PageGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { byRoute, loading } = usePageSettings();
  const { user, loading: authLoading } = useAuth();
  const { isModerator, loading: rolesLoading } = useRoles();

  // Never gate admin routes — admins always need access.
  if (location.pathname.startsWith("/admin")) return <>{children}</>;

  // Dynamic content routes (/movies/:id, /series/:id, /anime/:id, /news/:id, /articles/:id)
  // are exempt from DB-driven visibility checks. These pages inherit visibility from
  // their parent listing route (/movies, /series, etc.) and must never be hidden
  // or redirected — even if the parent is marked hidden, the detail page renders
  // an in-page "Page Not Available" UI rather than redirecting.
  const isDynamicContentRoute =
    /^\/(?:[a-z]{2}\/)?(movies|anime|series|articles|news|summaries|entertainment)\//.test(location.pathname);
  if (isDynamicContentRoute) return <>{children}</>;

  if (loading || authLoading || rolesLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const status = resolveRouteStatus(location.pathname, byRoute);
  const isStaff = isModerator;

  if (status === "visible" || isStaff) return <>{children}</>;

  if (status === "maintenance") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Wrench className="mb-4 h-12 w-12 text-primary" />
        <h1 className="mb-2 text-2xl font-bold">Under Maintenance</h1>
        <p className="text-muted-foreground">This page is temporarily unavailable. Please check back soon.</p>
      </div>
    );
  }

  if (status === "admin_only" && !isStaff) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Lock className="mb-4 h-12 w-12 text-primary" />
        <h1 className="mb-2 text-2xl font-bold">Restricted</h1>
        <p className="text-muted-foreground">
          {user ? "You don't have access to this page." : "Please sign in to continue."}
        </p>
      </div>
    );
  }

  // hidden
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <EyeOff className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="mb-2 text-2xl font-bold">Page Not Available</h1>
      <p className="text-muted-foreground">This page is currently hidden.</p>
    </div>
  );
}
