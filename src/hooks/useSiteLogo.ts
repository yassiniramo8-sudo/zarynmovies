import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_LOGO = "/favicon.png";

export function useSiteLogo() {
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);

  const fetchLogo = useCallback(async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "site_logo_url")
      .single();
    if (data?.value) {
      setLogoUrl(data.value);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogo();
  }, [fetchLogo]);

  const updateLogo = async (url: string) => {
    setLogoUrl(url);
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "site_logo_url", value: url, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  };

  const restoreDefault = async () => {
    await updateLogo(DEFAULT_LOGO);
  };

  return { logoUrl, loading, updateLogo, restoreDefault, refetch: fetchLogo, DEFAULT_LOGO };
}
