import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PageTitleManager } from "@/components/PageTitleManager";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdBlockModal } from "@/components/AdBlockModal";
import { VipAdBlocker } from "@/components/VipAdBlocker";
import { TimedAdRenderer } from "@/components/TimedAdRenderer";
import { useAdBlockDetector } from "@/hooks/useAdBlockDetector";
import { useRoles } from "@/hooks/useRoles";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useThemeSettings, applyThemeToDOM } from "@/hooks/useThemeSettings";
import { useVipStatus } from "@/hooks/useVip";
import { useMyAdSettings } from "@/hooks/useUserAdSettings";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy-loaded pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MoviesPage = lazy(() => import("./pages/MoviesPage"));
const AnimePage = lazy(() => import("./pages/AnimePage"));
const HighlightsPage = lazy(() => import("./pages/HighlightsPage"));
const HighlightDetailPage = lazy(() => import("./pages/HighlightDetailPage"));
const NewsHubPage = lazy(() => import("./pages/NewsHubPage"));
const NewsDetailPage = lazy(() => import("./pages/NewsDetailPage"));
const PollsPage = lazy(() => import("./pages/PollsPage"));
const FeaturedClipsPage = lazy(() => import("./pages/FeaturedClipsPage"));
const SportsNewsPage = lazy(() => import("./pages/SportsNewsPage"));
const ArticlesPage = lazy(() => import("./pages/ArticlesPage"));
const ArticleDetailPage = lazy(() => import("./pages/ArticleDetailPage"));
const SeriesPage = lazy(() => import("./pages/SeriesPage"));
const SeriesDetailPage = lazy(() => import("./pages/SeriesDetailPage"));
const DetailPage = lazy(() => import("./pages/DetailPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SubscribePage = lazy(() => import("./pages/SubscribePage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const AboutUsPage = lazy(() => import("./pages/AboutUsPage"));
const ContactUsPage = lazy(() => import("./pages/ContactUsPage"));
const DmcaPage = lazy(() => import("./pages/DmcaPage"));
const EntertainmentAIPage = lazy(() => import("./pages/EntertainmentAIPage"));

// Admin pages
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminMovies = lazy(() => import("./pages/admin/AdminMovies"));
const AdminAnime = lazy(() => import("./pages/admin/AdminAnime"));
const AdminSeries = lazy(() => import("./pages/admin/AdminSeries"));
const AdminArticles = lazy(() => import("./pages/admin/AdminArticles"));
const AdminHighlights = lazy(() => import("./pages/admin/AdminHighlights"));
const AdminPolls = lazy(() => import("./pages/admin/AdminPolls"));
const AdminSportsNews = lazy(() => import("./pages/admin/AdminSportsNews"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminComments = lazy(() => import("./pages/admin/AdminComments"));
const AdminRoles = lazy(() => import("./pages/admin/AdminRoles"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAppearance = lazy(() => import("./pages/admin/AdminAppearance"));
const AdminSubscriptionPlans = lazy(() => import("./pages/admin/AdminSubscriptionPlans"));
const AdminPaymentMethods = lazy(() => import("./pages/admin/AdminPaymentMethods"));
const AdminSubscriptionRequests = lazy(() => import("./pages/admin/AdminSubscriptionRequests"));
const AdminVipMembers = lazy(() => import("./pages/admin/AdminVipMembers"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminTranslations = lazy(() => import("./pages/admin/AdminTranslations"));
const AdminContactMessages = lazy(() => import("./pages/admin/AdminContactMessages"));
const AdminEmailCampaigns = lazy(() => import("./pages/admin/AdminEmailCampaigns"));
const AdminExpiredUsers = lazy(() => import("./pages/admin/AdminExpiredUsers"));
const AdminAIMovies = lazy(() => import("./pages/admin/AdminAIMovies"));
const AdminAIArticles = lazy(() => import("./pages/admin/AdminAIArticles"));
const AdminAdvertisements = lazy(() => import("./pages/admin/AdminAdvertisements"));
const AdminSitemap = lazy(() => import("./pages/admin/AdminSitemap"));
const AdminAIChat = lazy(() => import("./pages/admin/AdminAIChat"));
const AdminAnimeGroups = lazy(() => import("./pages/admin/AdminAnimeGroups"));
const AdminLegalPages = lazy(() => import("./pages/admin/AdminLegalPages"));
const AdminNotificationControl = lazy(() => import("./pages/admin/AdminNotificationControl"));
const AdminContentScanner = lazy(() => import("./pages/admin/AdminContentScanner"));
const AdminNewsAggregator = lazy(() => import("./pages/admin/AdminNewsAggregator"));
const AdminAPIKeys = lazy(() => import("./pages/admin/AdminAPIKeys"));
const AdminAITranslate = lazy(() => import("./pages/admin/AdminAITranslate"));
const AdminPageManager = lazy(() => import("./pages/admin/AdminPageManager"));
const AdminHomepageBuilder = lazy(() => import("./pages/admin/AdminHomepageBuilder"));
const AdminPaginationSettings = lazy(() => import("./pages/admin/AdminPaginationSettings"));

import { PageGuard } from "@/components/PageGuard";

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/** Wraps a lazy-loaded page in both Suspense and ErrorBoundary */
function SafePage({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary name={name}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

const AppContent = () => {
  const adBlockDetected = useAdBlockDetector();
  const { roles, loading: rolesLoading } = useRoles();
  const { antiAdblockEnabled, loading: settingsLoading } = useSiteSettings();
  const { theme, loading: themeLoading } = useThemeSettings();
  const { adblockEnforcement, adsEnabled, loading: adSettingsLoading } = useMyAdSettings();
  const { isVip, loading: vipLoading } = useVipStatus();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin") || roles.includes("moderator");
  const adsSuppressed = isVip || !adsEnabled;
  const showAdBlockWall = antiAdblockEnabled && adblockEnforcement && adsEnabled && !isVip && adBlockDetected && !isAdmin && !rolesLoading && !settingsLoading && !adSettingsLoading && !vipLoading;

  React.useEffect(() => {
    if (themeLoading || vipLoading) return;
    // Only apply admin custom background in dark mode; light mode keeps the CSS palette clean.
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      applyThemeToDOM(theme, isVip);
    } else {
      // Still apply non-background overrides (nav, colors) but skip body background.
      applyThemeToDOM({ ...theme, backgroundImage: undefined, backgroundGradient: undefined, vipBackgroundEnabled: false }, false);
    }
  }, [theme, themeLoading, isVip, vipLoading]);

  // React to theme mode changes so background reapplies correctly.
  React.useEffect(() => {
    const obs = new MutationObserver(() => {
      if (themeLoading || vipLoading) return;
      const isDark = document.documentElement.classList.contains("dark");
      if (isDark) {
        applyThemeToDOM(theme, isVip);
      } else {
        document.body.style.background = "";
        document.body.style.backgroundImage = "";
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [theme, themeLoading, isVip, vipLoading]);


  return (
    <>
      <ErrorBoundary name="VipAdBlocker" silent><VipAdBlocker /></ErrorBoundary>
      <ErrorBoundary name="TimedAds" silent><TimedAdRenderer /></ErrorBoundary>
      {showAdBlockWall && <AdBlockModal />}
      <div className={showAdBlockWall ? "pointer-events-none select-none blur-sm" : ""}>
        <ErrorBoundary name="Navbar"><Navbar /></ErrorBoundary>
        <ErrorBoundary name="App">
          <Suspense fallback={<PageLoader />}>
            <PageGuard>
            <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/legacy-home" element={<Index />} />


            {/* Locale-prefixed content routes */}
            <Route path="/:lang/movies" element={<MoviesPage />} />
            <Route path="/:lang/movies/:id" element={<DetailPage />} />
            <Route path="/:lang/anime" element={<AnimePage />} />
            <Route path="/:lang/anime/:id" element={<DetailPage />} />
            <Route path="/:lang/series" element={<SeriesPage />} />
            <Route path="/:lang/series/:id" element={<SeriesDetailPage />} />
            <Route path="/:lang/news" element={<NewsHubPage />} />
            <Route path="/:lang/news/:id" element={<NewsDetailPage />} />
            <Route path="/:lang/news/sports" element={<SportsNewsPage />} />
            <Route path="/:lang/articles" element={<ArticlesPage />} />
            <Route path="/:lang/articles/:id" element={<ArticleDetailPage />} />

            {/* Non-locale routes (default) */}
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/movies/:id" element={<DetailPage />} />
            <Route path="/anime" element={<AnimePage />} />
            <Route path="/anime/:id" element={<DetailPage />} />
            <Route path="/series" element={<SeriesPage />} />
            <Route path="/series/:id" element={<SeriesDetailPage />} />
            <Route path="/news" element={<NewsHubPage />} />
            <Route path="/news/:id" element={<NewsDetailPage />} />
            <Route path="/news/polls" element={<PollsPage />} />
            <Route path="/news/clips" element={<FeaturedClipsPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />

            {/* Summaries */}
            <Route path="/summaries" element={<HighlightsPage />} />
            <Route path="/summaries/:type" element={<HighlightsPage />} />
            <Route path="/summaries/:type/:slug" element={<HighlightDetailPage />} />

            {/* Redirect old routes */}
            <Route path="/highlights" element={<Navigate to="/summaries" replace />} />
            <Route path="/highlights/:slug" element={<Navigate to="/summaries/sport" replace />} />
            <Route path="/news/summaries" element={<Navigate to="/summaries" replace />} />
            <Route path="/news/summaries/:slug" element={<Navigate to="/summaries/sport" replace />} />

            <Route path="/entertainment" element={<EntertainmentAIPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="movies" element={<AdminMovies />} />
              <Route path="anime" element={<AdminAnime />} />
              <Route path="series" element={<AdminSeries />} />
              <Route path="articles" element={<AdminArticles />} />
              <Route path="highlights" element={<AdminHighlights />} />
              <Route path="polls" element={<AdminPolls />} />
              <Route path="sports-news" element={<AdminSportsNews />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="comments" element={<AdminComments />} />
              <Route path="roles" element={<AdminRoles />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="appearance" element={<AdminAppearance />} />
              <Route path="pagination-settings" element={<AdminPaginationSettings />} />
              <Route path="subscription-plans" element={<AdminSubscriptionPlans />} />
              <Route path="payment-methods" element={<AdminPaymentMethods />} />
              <Route path="subscription-requests" element={<AdminSubscriptionRequests />} />
              <Route path="vip-members" element={<AdminVipMembers />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="translations" element={<AdminTranslations />} />
              <Route path="messages" element={<AdminContactMessages />} />
              <Route path="email-campaigns" element={<AdminEmailCampaigns />} />
              <Route path="expired-users" element={<AdminExpiredUsers />} />
              <Route path="ai-movies" element={<AdminAIMovies />} />
              <Route path="ai-articles" element={<AdminAIArticles />} />
              <Route path="advertisements" element={<AdminAdvertisements />} />
              <Route path="sitemap" element={<AdminSitemap />} />
              <Route path="ai-chat" element={<AdminAIChat />} />
              <Route path="anime-groups" element={<AdminAnimeGroups />} />
              <Route path="legal-pages" element={<AdminLegalPages />} />
              <Route path="notification-control" element={<AdminNotificationControl />} />
              <Route path="content-scanner" element={<AdminContentScanner />} />
              <Route path="news-aggregator" element={<AdminNewsAggregator />} />
              <Route path="api-keys" element={<AdminAPIKeys />} />
              <Route path="ai-translate" element={<AdminAITranslate />} />
              <Route path="pages" element={<AdminPageManager />} />
              <Route path="homepage" element={<AdminHomepageBuilder />} />
            </Route>
            <Route path="/subscribe" element={<SubscribePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-of-service" element={<TermsOfServicePage />} />
            <Route path="/about-us" element={<AboutUsPage />} />
            <Route path="/contact-us" element={<ContactUsPage />} />
            <Route path="/dmca" element={<DmcaPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PageGuard>
        </Suspense>
        </ErrorBoundary>
        <Footer />
      </div>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <PageTitleManager />
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
