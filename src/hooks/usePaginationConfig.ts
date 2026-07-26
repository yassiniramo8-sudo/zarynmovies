import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PaginationConfig {
  items_per_page: number;
  show_page_numbers: boolean;
  show_prev_next: boolean;
  show_first_last: boolean;
  pagination_style: "default" | "minimal" | "compact";
}

const DEFAULT_CONFIG: PaginationConfig = {
  items_per_page: 25,
  show_page_numbers: true,
  show_prev_next: true,
  show_first_last: true,
  pagination_style: "default",
};

// Module-level cache to avoid repeated fetches across renders
let cachedConfig: PaginationConfig | null = null;

export function usePaginationConfig() {
  const [config, setConfig] = useState<PaginationConfig>(cachedConfig ?? DEFAULT_CONFIG);
  const [loading, setLoading] = useState(!cachedConfig);

  const fetchConfig = useCallback(async () => {
    // Return cached value if already loaded
    if (cachedConfig) {
      setConfig(cachedConfig);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "pagination_config")
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        const merged = { ...DEFAULT_CONFIG, ...parsed };
        cachedConfig = merged;
        setConfig(merged);
      } else {
        cachedConfig = DEFAULT_CONFIG;
        setConfig(DEFAULT_CONFIG);
      }
    } catch {
      cachedConfig = DEFAULT_CONFIG;
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /** Invalidate cache (e.g. when admin saves new settings) */
  const invalidate = useCallback(() => {
    cachedConfig = null;
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, invalidate };
}