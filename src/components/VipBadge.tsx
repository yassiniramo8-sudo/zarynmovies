import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VipBadgeProps {
  size?: "sm" | "md";
  className?: string;
}

export function VipBadge({ size = "sm", className = "" }: VipBadgeProps) {
  return (
    <Badge
      className={`bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-0 gap-0.5 font-bold ${
        size === "sm" ? "text-[9px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      } ${className}`}
    >
      <Crown className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      VIP
    </Badge>
  );
}
