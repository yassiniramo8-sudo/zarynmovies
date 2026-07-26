import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";
import { useHomeLayout, HomeSection } from "@/hooks/useHomeLayout";
import { HeroCinema } from "@/components/home/HeroCinema";
import { AutoSection } from "@/components/home/AutoSection";
import { LiveStats } from "@/components/home/LiveStats";
import { FeaturedCollections } from "@/components/home/FeaturedCollections";
import { FooterExtras } from "@/components/home/FooterExtras";

function SectionRenderer({ section }: { section: HomeSection }) {
  switch (section.type) {
    case "hero":
      return <HeroCinema sectionId={section.id} settings={section.settings || {}} />;
    case "live_stats":
      return <LiveStats titleI18n={section.title_i18n} />;
    case "collections":
      return <FeaturedCollections titleI18n={section.title_i18n} />;
    case "footer_extras":
      return <FooterExtras titleI18n={section.title_i18n} />;
    case "continue_watching":
    case "trending":
    case "new_releases":
    case "popular_week":
    case "most_viewed_today":
    case "editor_picks":
    case "recently_added":
    case "ai_recs":
    case "category":
    case "vip":
      return <AutoSection section={section} />;
    default:
      return null;
  }
}

export default function HomePage() {
  const { sections, loading } = useHomeLayout();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zaryn Movies",
    url: typeof window !== "undefined" ? window.location.origin : "",
    potentialAction: {
      "@type": "SearchAction",
      target: `${typeof window !== "undefined" ? window.location.origin : ""}/movies?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const heroSection = sections.find((s) => s.type === "hero");
  const others = sections.filter((s) => s.type !== "hero");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Stream Movies, Anime & Series"
        description="Zaryn Movies — Netflix-quality streaming for movies, anime, series, news and more. Discover trending content, curated collections, and VIP exclusives."
        jsonLd={jsonLd}
      />

      {heroSection && <SectionRenderer section={heroSection} />}

      <div className="container mx-auto space-y-12 px-3 py-10 sm:px-4 md:space-y-16 md:py-14">
        <AdvertisementRenderer placement="home_top" />
        {others.map((s) => (
          <SectionRenderer key={s.id} section={s} />
        ))}
        <AdvertisementRenderer placement="home_bottom" />
      </div>
    </div>
  );
}
