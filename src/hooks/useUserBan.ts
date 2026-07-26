import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface BanInfo {
  isBanned: boolean;
  reason: string | null;
  expiresAt: Date | null;
  remainingText: string | null;
}

function formatRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return "";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function useUserBan() {
  const { user } = useAuth();
  const [banInfo, setBanInfo] = useState<BanInfo>({
    isBanned: false, reason: null, expiresAt: null, remainingText: null,
  });
  const [loading, setLoading] = useState(true);

  const checkBan = useCallback(async () => {
    if (!user) {
      setBanInfo({ isBanned: false, reason: null, expiresAt: null, remainingText: null });
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("user_bans")
      .select("*")
      .eq("user_id", user.id);

    if (!data || data.length === 0) {
      setBanInfo({ isBanned: false, reason: null, expiresAt: null, remainingText: null });
      setLoading(false);
      return;
    }

    // Check for active bans (permanent or not yet expired)
    const activeBan = data.find((b) => {
      if (b.ban_type === "permanent") return true;
      if (b.expires_at && new Date(b.expires_at) > new Date()) return true;
      return false;
    });

    if (activeBan) {
      const expiresAt = activeBan.expires_at ? new Date(activeBan.expires_at) : null;
      setBanInfo({
        isBanned: true,
        reason: activeBan.reason,
        expiresAt,
        remainingText: activeBan.ban_type === "permanent"
          ? "Permanent ban"
          : expiresAt ? formatRemaining(expiresAt) : null,
      });
    } else {
      setBanInfo({ isBanned: false, reason: null, expiresAt: null, remainingText: null });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { checkBan(); }, [checkBan]);

  // Update remaining text every minute
  useEffect(() => {
    if (!banInfo.isBanned || !banInfo.expiresAt) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (banInfo.expiresAt && banInfo.expiresAt <= now) {
        checkBan(); // Re-check, ban may have expired
      } else if (banInfo.expiresAt) {
        setBanInfo((prev) => ({ ...prev, remainingText: formatRemaining(banInfo.expiresAt!) }));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [banInfo.isBanned, banInfo.expiresAt, checkBan]);

  return { ...banInfo, loading };
}

// Utility to format remaining time for admin display
export function formatBanRemaining(expiresAt: string | null, banType: string): string {
  if (banType === "permanent") return "Permanent";
  if (!expiresAt) return "Unknown";
  const exp = new Date(expiresAt);
  const now = new Date();
  if (exp <= now) return "Expired";
  const diff = exp.getTime() - now.getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
