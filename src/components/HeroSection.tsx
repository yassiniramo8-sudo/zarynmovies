import { Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ContentItem } from "@/data/mock";

interface HeroSectionProps {
  featured?: ContentItem;
}

export function HeroSection({ featured }: HeroSectionProps) {
  const { t } = useLanguage();

  if (!featured) {
    return (
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20">
        <div className="container relative mx-auto flex h-full items-end px-4 pb-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-xl">
            <h1 className="mb-4 font-display text-5xl font-bold leading-tight text-foreground md:text-6xl">
              {t("hero.welcome")}
            </h1>
            <p className="mb-6 text-lg text-muted-foreground">{t("hero.subtitle")}</p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
      <img src={featured.poster} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />

      <div className="container relative mx-auto flex h-full items-end px-4 pb-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-xl">
          <span className="mb-3 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t("hero.trendingNow")}
          </span>
          <h1 className="mb-4 font-display text-5xl font-bold leading-tight text-foreground md:text-6xl">
            {featured.title}
          </h1>
          <p className="mb-6 text-lg text-muted-foreground">{featured.description}</p>
          <div className="flex gap-3">
            <Button size="lg" className="gap-2 gradient-brand text-primary-foreground">
              <Play className="h-5 w-5" /> {t("hero.watchNow")}
            </Button>
            <Button size="lg" variant="outline" className="gap-2 border-border/50">
              <Plus className="h-5 w-5" /> {t("hero.watchLater")}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
