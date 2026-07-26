import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { translations, Language, LANGUAGES } from "@/i18n/translations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const VALID_LANGS = LANGUAGES.map((l) => l.code);

function getInitialLanguage(): Language {
  const saved = localStorage.getItem("zaryn-language");
  if (saved && VALID_LANGS.includes(saved as Language)) return saved as Language;
  const browserLang = navigator.language.slice(0, 2);
  if (VALID_LANGS.includes(browserLang as Language)) return browserLang as Language;
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const langConfig = LANGUAGES.find((l) => l.code === language)!;
  const dir = langConfig.dir;

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("zaryn-language", lang);
  }, []);

  // Apply dir and lang to <html>
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", language);
  }, [language, dir]);

  const t = useCallback(
    (key: string): string => {
      const trans = translations[language];
      return (trans as any)[key] || (translations.en as any)[key] || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      <LanguageSyncProvider language={language} setLanguage={setLanguage}>
        {children}
      </LanguageSyncProvider>
    </LanguageContext.Provider>
  );
}

/** Syncs language preference with user profile in DB */
function LanguageSyncProvider({
  children,
  language,
  setLanguage,
}: {
  children: ReactNode;
  language: Language;
  setLanguage: (lang: Language) => void;
}) {
  const { user } = useAuth();

  // Load language from profile on login
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("language_preference")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.language_preference && VALID_LANGS.includes(data.language_preference as Language)) {
        setLanguage(data.language_preference as Language);
      }
    };
    load();
  }, [user?.id]);

  // Save language to profile when changed
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .update({ language_preference: language } as any)
      .eq("id", user.id)
      .then();
  }, [language, user?.id]);

  return <>{children}</>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
