import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Overlay shown on VIP-only content when the user is not a VIP subscriber.
 */
export function VipContentGate() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Crown className="h-10 w-10 text-amber-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border-2 border-amber-500/50 flex items-center justify-center">
          <Lock className="h-4 w-4 text-amber-500" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-foreground font-display">
        {t("vip.premiumContent") || "Premium Content"}
      </h2>
      <p className="text-muted-foreground max-w-md">
        {t("vip.upgradeMessage") || "This content is exclusive to VIP members. Upgrade your plan to unlock full access."}
      </p>
      <Link to="/subscribe">
        <Button size="lg" className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold hover:from-amber-600 hover:to-yellow-500">
          <Crown className="h-5 w-5" />
          {t("vip.upgradeToPremium") || "Upgrade to VIP"}
        </Button>
      </Link>
    </div>
  );
}
