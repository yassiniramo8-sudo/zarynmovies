import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSiteSettings() {
  const [antiAdblockEnabled, setAntiAdblockEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchSetting = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "anti_adblock_enabled")
      .single();
    setAntiAdblockEnabled(data?.value === "true");
    setLoading(false);
  };

  useEffect(() => {
    fetchSetting();
  }, []);

  const toggleAntiAdblock = async (enabled: boolean) => {
    setAntiAdblockEnabled(enabled);
    await supabase
      .from("site_settings")
      .update({ value: enabled ? "true" : "false", updated_at: new Date().toISOString() })
      .eq("key", "anti_adblock_enabled");
  };

  return { antiAdblockEnabled, loading, toggleAntiAdblock, refetch: fetchSetting };
}
