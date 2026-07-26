import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ContentTranslationRow {
  content_id: string;
  language: string;
  title: string;
  description: string | null;
  content_type: string;
}

/**
 * Hook to fetch cached translations for a LIST of content items (movies/series/anime).
 * Movie/Series/Anime titles are NEVER translated — only descriptions.
 */
export function useBatchContentTranslations(
  contentIds: string[],
  contentType: string
) {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<Record<string, ContentTranslationRow>>({});
  const [loading, setLoading] = useState(false);

  const targetLang = useMemo(() => {
    if (language === "en") return "en";
    return language;
  }, [language]);

  const idsKey = contentIds.sort().join(",");

  useEffect(() => {
    if (!contentIds.length || targetLang === "en") {
      setTranslations({});
      return;
    }

    setLoading(true);
    supabase
      .from("content_translations")
      .select("content_id, language, title, description, content_type")
      .eq("content_type", contentType)
      .eq("language", targetLang)
      .in("content_id", contentIds)
      .then(({ data }) => {
        const map: Record<string, ContentTranslationRow> = {};
        (data || []).forEach((t: any) => {
          map[t.content_id] = t;
        });
        setTranslations(map);
        setLoading(false);
      });
  }, [idsKey, contentType, targetLang]);

  const getDescription = useCallback(
    (id: string, originalDescription: string | null): string => {
      if (targetLang === "en") return originalDescription || "";
      const trans = translations[id];
      if (trans?.description) return trans.description;
      return originalDescription || "";
    },
    [translations, targetLang]
  );

  const getTitle = useCallback(
    (id: string, originalTitle: string): string => {
      if (targetLang === "en") return originalTitle;
      const trans = translations[id];
      if (trans?.title) return trans.title;
      return originalTitle;
    },
    [translations, targetLang]
  );

  return { getDescription, getTitle, targetLang, loading };
}
