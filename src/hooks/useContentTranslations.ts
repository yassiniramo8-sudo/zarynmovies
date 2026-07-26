import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface ContentTranslation {
  content_id: string;
  language: string;
  title: string;
  description: string | null;
  content: string | null;
  content_type: string;
}

/**
 * Hook to fetch cached translations for movies/series/anime/articles.
 * Movie titles are NEVER translated — only descriptions.
 */
export function useContentTranslations(contentId: string | undefined, contentType: string) {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<Record<string, ContentTranslation>>({});
  const [loading, setLoading] = useState(false);

  const targetLang = useMemo(() => {
    if (language === "en") return "en";
    return language;
  }, [language]);

  useEffect(() => {
    if (!contentId) {
      setTranslations({});
      return;
    }

    // Always fetch translations (including for English, since original might be Arabic)
    setLoading(true);
    supabase
      .from("content_translations")
      .select("*")
      .eq("content_id", contentId)
      .eq("content_type", contentType)
      .then(({ data }) => {
        const map: Record<string, ContentTranslation> = {};
        (data || []).forEach((t: any) => {
          map[t.language] = t;
        });
        setTranslations(map);
        setLoading(false);
      });
  }, [contentId, contentType, targetLang]);

  /**
   * Get translated description/content for an item.
   * Movie titles are NEVER translated.
   */
  const getTranslatedField = useCallback(
    (
      original: { title?: string; description?: string | null; content?: string | null },
      field: "title" | "description" | "content"
    ): string => {
      // Movie titles must NEVER be translated
      if (field === "title" && contentType === "movie") {
        return original.title || "";
      }

      // For English, use original
      if (targetLang === "en") {
        return (original[field] as string) || "";
      }

      // Check cached translation
      const trans = translations[targetLang];
      if (trans) {
        if (field === "title" && trans.title) return trans.title;
        if (field === "description" && trans.description) return trans.description;
        if (field === "content" && trans.content) return trans.content;
      }

      // Fallback to original
      return (original[field] as string) || "";
    },
    [translations, targetLang, contentType]
  );

  return { getTranslatedField, targetLang, loading, translations };
}
