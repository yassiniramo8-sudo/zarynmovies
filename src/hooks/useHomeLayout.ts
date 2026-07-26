import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";

export interface HomeSection {
  id: string;
  key: string;
  type: string;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  enabled: boolean;
  sort_order: number;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface HomeSectionItem {
  id: string;
  section_id: string;
  content_type: string;
  content_id: string;
  sort_order: number;
  active: boolean;
}

/** Live homepage layout — realtime + debounced */
export function useHomeLayout(includeDisabled = false) {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);

  const fetch = useCallback(async () => {
    let q = (supabase as any).from("home_sections").select("*").order("sort_order", { ascending: true });
    if (!includeDisabled) q = q.eq("enabled", true);
    const { data } = await q;
    setSections((data as HomeSection[]) || []);
    setLoading(false);
  }, [includeDisabled]);

  useEffect(() => {
    fetch();
    const unsub = realtimeManager.subscribe("home-sections", {
      tables: [{ schema: "public", table: "home_sections" }],
      onChange: () => fetch(),
      debounceMs: 400,
    });
    return () => { unsub(); };
  }, [fetch]);

  return { sections, loading, refetch: fetch };
}

/** Manually curated items for a section (Editor Picks, VIP, Hero manual) */
export function useSectionItems(sectionId: string | null | undefined) {
  const [items, setItems] = useState<HomeSectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!sectionId) { setItems([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("home_section_items")
      .select("*")
      .eq("section_id", sectionId)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    setItems((data as HomeSectionItem[]) || []);
    setLoading(false);
  }, [sectionId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { items, loading, refetch: fetch };
}
