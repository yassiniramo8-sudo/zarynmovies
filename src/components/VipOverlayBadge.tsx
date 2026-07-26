import { Crown } from "lucide-react";

/**
 * Overlay badge shown on content card thumbnails for VIP-only content.
 */
export function VipOverlayBadge() {
  return (
    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 px-2 py-1 text-[10px] font-bold text-black shadow-lg">
      <Crown className="h-3 w-3" />
      VIP
    </div>
  );
}
