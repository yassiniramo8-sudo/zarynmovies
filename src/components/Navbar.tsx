import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Shield, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRoles } from "@/hooks/useRoles";
import { useSiteLogo } from "@/hooks/useSiteLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePageSettings } from "@/hooks/usePageSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, loading } = useAuth();
  const { isModerator } = useRoles();
  const { t, language } = useLanguage();
  const { logoUrl } = useSiteLogo();
  const { byRoute } = usePageSettings();
  const isAr = language === "ar";

  const allLinks = [
    { label: t("nav.home"), to: "/" },
    { label: t("nav.movies"), to: "/movies" },
    { label: t("nav.anime"), to: "/anime" },
    { label: t("nav.series"), to: "/series" },
    { label: isAr ? "ملخصات" : "Summaries", to: "/summaries" },
    { label: t("nav.news"), to: "/news" },
    { label: t("nav.articles"), to: "/articles" },
    { label: "VIP", to: "/subscribe", icon: Crown },
    { label: "Support Center", to: "/contact" },
  ];

  // Filter menu by DB-driven visibility: hide if not marked show_in_nav OR status hidden.
  const links = useMemo(() => {
    return allLinks.filter((l) => {
      const s = byRoute.get(l.to);
      if (!s) return true; // unknown routes stay visible by default
      if (!s.show_in_nav) return false;
      return s.status === "visible" || s.status === "admin_only";
    });
  }, [byRoute, language]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };


  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl" style={{ backgroundColor: "var(--theme-nav-bg, hsl(var(--background) / 0.8))" }}>
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 rtl:flex-row-reverse">
          <img
            src={logoUrl}
            alt="ZarynMovies Logo"
            className="h-9 w-9 rounded-full object-contain"
            loading="eager"
          />
          <span className="font-display text-2xl font-bold text-gradient-brand">ZARYN</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                location.pathname === l.to
                  ? "bg-primary/10 text-primary"
                  : "hover:text-foreground"
              )}
              style={{ color: location.pathname !== l.to ? "var(--theme-nav-text, hsl(var(--muted-foreground)))" : undefined }}
            >
              {l.label}
            </Link>
          ))}

        </div>

        <div className="flex items-center gap-2 p-1.5">
          <LanguageSwitcher />

          <ThemeToggle />

          {user && <NotificationBell />}

          {!loading && (
            <>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="overflow-hidden rounded-full">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium text-foreground">{profile?.username || "User"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" /> {t("nav.profile")}
                    </DropdownMenuItem>
                    {isModerator && (
                      <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" /> {t("nav.adminDashboard")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                      <LogOut className="mr-2 h-4 w-4" /> {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  className="gradient-brand text-primary-foreground hidden sm:inline-flex"
                  onClick={() => navigate("/auth")}
                >
                  {t("nav.signIn")}
                </Button>
              )}
            </>
          )}

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isAr ? "left" : "right"} className="w-[85%] max-w-sm p-0 flex flex-col">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
                  <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-full" />
                  <span className="font-display text-lg font-bold text-gradient-brand">ZARYN</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <div className="flex flex-col gap-1">
                  {links.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                        location.pathname === l.to
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="border-t border-border/50 p-3 flex items-center justify-between gap-2">
                <LanguageSwitcher />
                <ThemeToggle />
                {!user && (
                  <Button
                    size="sm"
                    className="gradient-brand text-primary-foreground flex-1"
                    onClick={() => {
                      setOpen(false);
                      navigate("/auth");
                    }}
                  >
                    {t("nav.signIn")}
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

