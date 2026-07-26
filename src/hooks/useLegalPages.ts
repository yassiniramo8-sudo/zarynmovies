import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export type LegalPageKey = "privacy_policy" | "terms_of_service" | "about_us" | "contact_us" | "dmca";

interface LegalPage {
  id: string;
  page_key: string;
  language: string;
  title: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by: string | null;
}

export function useLegalPage(pageKey: LegalPageKey) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: ["legal-page", pageKey, language],
    queryFn: async () => {
      // Get latest version for current language
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("page_key", pageKey)
        .eq("language", language)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Fallback to English if no content for current language
      if (!data && language !== "en") {
        const { data: enData } = await supabase
          .from("legal_pages")
          .select("*")
          .eq("page_key", pageKey)
          .eq("language", "en")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        return enData as LegalPage | null;
      }

      return data as LegalPage | null;
    },
  });
}

export function useAllLegalPages() {
  return useQuery({
    queryKey: ["legal-pages-all"],
    queryFn: async () => {
      // Get all pages, grouped by page_key + language, latest version only
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .order("page_key")
        .order("language")
        .order("version", { ascending: false });

      if (error) throw error;

      // Deduplicate: keep only latest version per page_key+language
      const seen = new Set<string>();
      const latest: LegalPage[] = [];
      for (const row of data || []) {
        const key = `${row.page_key}__${row.language}`;
        if (!seen.has(key)) {
          seen.add(key);
          latest.push(row as LegalPage);
        }
      }
      return latest;
    },
  });
}

export function useSaveLegalPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (page: { page_key: string; language: string; title: string; content: string; version?: number }) => {
      // Get current max version
      const { data: existing } = await supabase
        .from("legal_pages")
        .select("version")
        .eq("page_key", page.page_key)
        .eq("language", page.language)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (existing?.version || 0) + 1;

      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase.from("legal_pages").insert({
        page_key: page.page_key,
        language: page.language,
        title: page.title,
        content: page.content,
        version: nextVersion,
        updated_by: user.user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-pages-all"] });
      queryClient.invalidateQueries({ queryKey: ["legal-page"] });
    },
  });
}

export function useLegalPageHistory(pageKey: string, language: string) {
  return useQuery({
    queryKey: ["legal-page-history", pageKey, language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_pages")
        .select("*")
        .eq("page_key", pageKey)
        .eq("language", language)
        .order("version", { ascending: false });

      if (error) throw error;
      return (data || []) as LegalPage[];
    },
    enabled: !!pageKey && !!language,
  });
}
