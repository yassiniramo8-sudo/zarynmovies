import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PremiumCarousel } from "./PremiumCarousel";
import { HomeCard, HomeCardItem } from "./HomeCard";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";

interface Props {
  sectionKey: string;
  titleI18n: Record<string, string>;
  descI18n?: Record<string, string>;
  items: (HomeCardItem & { progressPct?: number })[];
  loading?: boolean;
  action?: ReactNode;
  showBetweenAds?: boolean;
  betweenAdEvery?: number;
}

/** Standard homepage rail: title + carousel + ad slot below. */
export function SectionRail({ sectionKey, titleI18n, descI18n, items, loading, action, showBetweenAds, betweenAdEvery = 8 }: Props) {
  const { language } = useLanguage();
  const title = titleI18n[language] || titleI18n.en || sectionKey;
  const desc = descI18n?.[language] || descI18n?.en;

  if (!loading && items.length === 0) return null;

  const withAds: ReactNode[] = [];
  items.forEach((it, i) => {
    withAds.push(<HomeCard key={it.id} item={it} priority={i < 4} progressPct={it.progressPct} />);
    if (showBetweenAds && (i + 1) % betweenAdEvery === 0 && i < items.length - 1) {
      withAds.push(
        <div key={`ad-${i}`} className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/30 p-2">
          <AdvertisementRenderer placement={`home_between_cards_${sectionKey}`} />
        </div>
      );
    }
  });

  return (
    <section className="space-y-3">
      <AdvertisementRenderer placement={`home_section_top_${sectionKey}`} />
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl md:text-3xl">{title}</h2>
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
        {action}
      </div>
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[330px] w-[200px] shrink-0 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <PremiumCarousel>{withAds}</PremiumCarousel>
      )}
      <AdvertisementRenderer placement={`home_section_bottom_${sectionKey}`} />
    </section>
  );
}
