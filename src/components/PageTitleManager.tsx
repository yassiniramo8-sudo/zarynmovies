import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const SITE = "Zaryn Movies";

const ROUTE_TITLES: Record<string, Record<string, string>> = {
  "/": {
    en: "Movies", ar: "أفلام", es: "Películas", de: "Filme", pt: "Filmes",
    fr: "Films", tr: "Filmler", ja: "映画", ko: "영화", hi: "फिल्में",
  },
  "/home": {
    en: "Home", ar: "الرئيسية", es: "Inicio", de: "Startseite", pt: "Início",
    fr: "Accueil", tr: "Ana Sayfa", ja: "ホーム", ko: "홈", hi: "होम",
  },
  "/movies": {
    en: "Movies", ar: "أفلام", es: "Películas", de: "Filme", pt: "Filmes",
    fr: "Films", tr: "Filmler", ja: "映画", ko: "영화", hi: "फिल्में",
  },
  "/anime": {
    en: "Anime", ar: "أنمي", es: "Anime", de: "Anime", pt: "Anime",
    fr: "Anime", tr: "Anime", ja: "アニメ", ko: "애니메이션", hi: "एनीमे",
  },
  "/series": {
    en: "Series", ar: "مسلسلات", es: "Series", de: "Serien", pt: "Séries",
    fr: "Séries", tr: "Diziler", ja: "シリーズ", ko: "시리즈", hi: "श्रृंखला",
  },
  "/summaries": {
    en: "Summaries", ar: "ملخصات", es: "Resúmenes", de: "Zusammenfassungen", pt: "Resumos",
    fr: "Résumés", tr: "Özetler", ja: "まとめ", ko: "요약", hi: "सारांश",
  },
  "/news": {
    en: "News", ar: "أخبار", es: "Noticias", de: "Nachrichten", pt: "Notícias",
    fr: "Actualités", tr: "Haberler", ja: "ニュース", ko: "뉴스", hi: "समाचार",
  },
  "/articles": {
    en: "Articles", ar: "مقالات", es: "Artículos", de: "Artikel", pt: "Artigos",
    fr: "Articles", tr: "Makaleler", ja: "記事", ko: "기사", hi: "लेख",
  },
  "/subscribe": {
    en: "VIP", ar: "VIP", es: "VIP", de: "VIP", pt: "VIP",
    fr: "VIP", tr: "VIP", ja: "VIP", ko: "VIP", hi: "VIP",
  },
  "/contact": {
    en: "Contact", ar: "اتصل بنا", es: "Contacto", de: "Kontakt", pt: "Contato",
    fr: "Contact", tr: "İletişim", ja: "お問い合わせ", ko: "연락처", hi: "संपर्क",
  },
  "/contact-us": {
    en: "Contact Us", ar: "تواصل معنا", es: "Contáctanos", de: "Kontaktieren Sie uns", pt: "Fale Conosco",
    fr: "Contactez-nous", tr: "Bize Ulaşın", ja: "お問い合わせ", ko: "문의하기", hi: "हमसे संपर्क करें",
  },
  "/entertainment": {
    en: "Entertainment AI", ar: "الذكاء الترفيهي", es: "Entretenimiento IA", de: "Unterhaltungs-KI", pt: "Entretenimento IA",
    fr: "IA de divertissement", tr: "Eğlence AI", ja: "エンタメAI", ko: "엔터테인먼트 AI", hi: "मनोरंजन AI",
  },
  "/auth": {
    en: "Sign In", ar: "تسجيل الدخول", es: "Iniciar sesión", de: "Anmelden", pt: "Entrar",
    fr: "Connexion", tr: "Giriş", ja: "ログイン", ko: "로그인", hi: "साइन इन",
  },
  "/profile": {
    en: "Profile", ar: "الملف الشخصي", es: "Perfil", de: "Profil", pt: "Perfil",
    fr: "Profil", tr: "Profil", ja: "プロフィール", ko: "프로필", hi: "प्रोफ़ाइल",
  },
  "/about-us": {
    en: "About Us", ar: "من نحن", es: "Sobre nosotros", de: "Über uns", pt: "Sobre nós",
    fr: "À propos", tr: "Hakkımızda", ja: "私たちについて", ko: "소개", hi: "हमारे बारे में",
  },
  "/privacy-policy": {
    en: "Privacy Policy", ar: "سياسة الخصوصية", es: "Política de privacidad", de: "Datenschutz", pt: "Política de Privacidade",
    fr: "Politique de confidentialité", tr: "Gizlilik Politikası", ja: "プライバシーポリシー", ko: "개인정보 처리방침", hi: "गोपनीयता नीति",
  },
  "/terms-of-service": {
    en: "Terms of Service", ar: "شروط الخدمة", es: "Términos de servicio", de: "Nutzungsbedingungen", pt: "Termos de Serviço",
    fr: "Conditions d'utilisation", tr: "Kullanım Koşulları", ja: "利用規約", ko: "서비스 약관", hi: "सेवा की शर्तें",
  },
  "/dmca": {
    en: "DMCA", ar: "DMCA", es: "DMCA", de: "DMCA", pt: "DMCA",
    fr: "DMCA", tr: "DMCA", ja: "DMCA", ko: "DMCA", hi: "DMCA",
  },
};

function resolveTitle(pathname: string, language: string): string {
  // Strip locale prefix like /ar/movies -> /movies
  const stripped = pathname.replace(/^\/(ar|en|es|de|pt|fr|tr|ja|ko|hi)\//, "/");

  // Exact match
  if (ROUTE_TITLES[stripped]) {
    return ROUTE_TITLES[stripped][language] || ROUTE_TITLES[stripped].en || SITE;
  }

  // Match base path (e.g. /movies/some-id -> /movies)
  const base = "/" + stripped.split("/").filter(Boolean)[0];
  if (ROUTE_TITLES[base]) {
    return ROUTE_TITLES[base][language] || ROUTE_TITLES[base].en || SITE;
  }

  return SITE;
}

export function PageTitleManager() {
  const { pathname } = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    const title = resolveTitle(pathname, language);
    document.title = title === SITE ? SITE : `${title} | ${SITE}`;
  }, [pathname, language]);

  return null;
}
