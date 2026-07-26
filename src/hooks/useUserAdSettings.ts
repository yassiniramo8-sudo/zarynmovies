import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { realtimeManager } from "@/lib/realtimeManager";

export interface UserAdSetting {
  user_id: string;
  ads_enabled: boolean;
  adblock_enforcement: boolean;
}

export function useUserAdSettings() {
  const [settings, setSettings] = useState<UserAdSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchSettings = async () => {
    if (!mountedRef.current) return;
    try {
      const { data } = await supabase.from("user_ad_settings").select("user_id, ads_enabled, adblock_enforcement");
      if (mountedRef.current) {
        setSettings(data || []);
      }
    } catch (err) {
      console.error("[useUserAdSettings] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchSettings();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateSetting = async (userId: string, field: "ads_enabled" | "adblock_enforcement", value: boolean) => {
    const existing = settings.find((s) => s.user_id === userId);
    if (existing) {
      await supabase.from("user_ad_settings").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("user_id", userId);
    } else {
      await supabase.from("user_ad_settings").insert({ user_id: userId, [field]: value } as any);
    }
    // Optimistic update
    setSettings((prev) => {
      const idx = prev.findIndex((s) => s.user_id === userId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: value };
        return copy;
      }
      return [...prev, { user_id: userId, ads_enabled: true, adblock_enforcement: true, [field]: value }];
    });
  };

  return { settings, loading, updateSetting, refetch: fetchSettings };
}

/** Hook for the current user's own ad settings */
export function useMyAdSettings() {
  const { user } = useAuth();
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [adblockEnforcement, setAdblockEnforcement] = useState(true);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useRef(async () => {
    if (!user?.id || !mountedRef.current) return;
    try {
      const { data } = await supabase
        .from("user_ad_settings")
        .select("ads_enabled, adblock_enforcement")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mountedRef.current) return;
      setAdsEnabled(data ? data.ads_enabled : true);
      setAdblockEnforcement(data ? data.adblock_enforcement : true);
    } catch (err) {
      console.error("[useMyAdSettings] fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  });

  useEffect(() => {
    mountedRef.current = true;
    if (!user) {
      setAdsEnabled(true);
      setAdblockEnforcement(true);
      setLoading(false);
      return;
    }

    load.current();

    const unsub = realtimeManager.subscribe(`user-ad-settings-${user.id}`, {
      tables: [{ schema: "public", table: "user_ad_settings" }],
      filter: `user_id=eq.${user.id}`,
      onChange: () => load.current(),
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [user?.id]);

  return { adsEnabled, adblockEnforcement, loading };
}