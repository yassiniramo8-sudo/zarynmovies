import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function SectionHeader({ title, href }: { title: string; href?: string }) {
  const { t } = useLanguage();

  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="font-display text-2xl font-bold text-foreground">{title}</h2>
      {href && (
        <Link to={href} className="flex items-center gap-1 text-sm text-primary hover:underline">
          {t("index.viewAll")} <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
