import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { realtimeManager } from "@/lib/realtimeManager";

export function useVipStatus(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;
  const [isVip, setIsVip] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const checkRef = useRef<() => Promise<void>>();

  useEffect(() => {
    mountedRef.current = true;
    if (!targetId) {
      setIsVip(false);
      setSubscription(null);
      setLoading(false);
      return;
    }

    const check = async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from("user_subscriptions")
          .select("*, plan:subscription_plans(*)")
          .eq("user_id", targetId)
          .gte("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1);
        if (!mountedRef.current) return;
        const active = data && data.length > 0 ? data[0] : null;
        setIsVip(!!active);
        setSubscription(active);
      } catch (err) {
        console.error("[useVipStatus] check failed:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    checkRef.current = check;
    check();

    const unsub = realtimeManager.subscribe(`vip-status-${targetId}`, {
      tables: [{ schema: "public", table: "user_subscriptions" }],
      filter: `user_id=eq.${targetId}`,
      onChange: () => checkRef.current?.(),
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [targetId]);

  return { isVip, subscription, loading };
}

export function useVipStatusBatch(userIds: string[]) {
  const [vipMap, setVipMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (userIds.length === 0) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from("user_subscriptions")
          .select("user_id, expires_at")
          .in("user_id", userIds)
          .gte("expires_at", new Date().toISOString());
        const map: Record<string, boolean> = {};
        (data || []).forEach((s) => {
          map[s.user_id] = true;
        });
        setVipMap(map);
      } catch (err) {
        console.error("[useVipStatusBatch] fetch failed:", err);
      }
    };
    fetch();
  }, [userIds.join(",")]);

  return vipMap;
}