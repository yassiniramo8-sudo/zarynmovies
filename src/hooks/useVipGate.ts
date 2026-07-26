import { useMemo } from "react";
import { useVipStatus } from "@/hooks/useVip";

interface Server {
  name: string;
  url: string;
  quality?: string;
  size?: string;
  access_level?: "public" | "vip";
}

/**
 * Filters servers and download links based on VIP status.
 * VIP-only servers are stripped from the DOM for non-VIP users (security).
 */
export function useVipGate() {
  const { isVip, loading } = useVipStatus();

  const filterServers = useMemo(() => {
    return (servers: Server[] | undefined | null): Server[] => {
      if (!servers || !Array.isArray(servers)) return [];
      if (isVip) return servers; // VIP sees everything
      return servers.filter((s) => s.access_level !== "vip");
    };
  }, [isVip]);

  return { isVip, loading, filterServers };
}
