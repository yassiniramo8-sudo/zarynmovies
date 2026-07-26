import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface Translation {
  news_id: string;
  language: string;
  title: string;
  excerpt: string | null;
  content: string | null;
}

/**
 * Hook to fetch cached translations for news articles.
 * Falls back to original title/title_ar fields if no translation cached.
 */
export function useNewsTranslations(newsIds: string[]) {
  const { language } = useLanguage();
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [loading, setLoading] = useState(false);

  // Map language code to news translation language
  const newsLang = useMemo(() => {
    if (language === "en") return "en";
    return language; // pass through all supported languages
  }, [language]);

  useEffect(() => {
    if (!newsIds.length) {
      setTranslations({});
      return;
    }

    setLoading(true);
    supabase
      .from("news_translations")
      .select("news_id, language, title, excerpt, content")
      .in("news_id", newsIds)
      .eq("language", newsLang)
      .then(({ data }) => {
        const map: Record<string, Translation> = {};
        (data || []).forEach((t: any) => {
          map[t.news_id] = t;
        });
        setTranslations(map);
        setLoading(false);
      });
  }, [newsIds.join(","), newsLang]);

  /**
   * Get translated field for an article, with fallback chain:
   * 1. Cached translation in target language
   * 2. Native ar field (if target is ar)
   * 3. Original field
   */
  const getField = (
    article: { id: string; title?: string; title_ar?: string | null; excerpt?: string | null; excerpt_ar?: string | null; content?: string | null; content_ar?: string | null },
    field: "title" | "excerpt" | "content"
  ): string => {
    // Check cached translation
    const trans = translations[article.id];
    if (trans && trans[field]) return trans[field] as string;

    // Fallback to native ar fields
    if (newsLang === "ar") {
      const arField = `${field}_ar` as keyof typeof article;
      if (article[arField]) return article[arField] as string;
    }

    // Fallback to original
    return (article[field as keyof typeof article] as string) || "";
  };

  return { getField, newsLang, loading };
}
