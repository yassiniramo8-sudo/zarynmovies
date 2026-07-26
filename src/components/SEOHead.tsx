import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "video.movie";
  publishedAt?: string;
  modifiedAt?: string;
  tags?: string[];
  noIndex?: boolean;
  jsonLd?: Record<string, any>;
}

const SITE_NAME = "Zaryn Movies";
const DEFAULT_IMAGE = "/logo.png";

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  ar: "المنصة الأمثل لمشاهدة أحدث الأفلام، الأنمي، والمسلسلات، والبقاء على اطلاع بآخر الأخبار العالمية والدولية لحظة بلحظة.",
  en: "The ultimate platform to watch the latest movies, anime, and series, and stay updated with the latest international and global news.",
  es: "La plataforma definitiva para ver las últimas películas, anime y series, y mantenerse al día con las últimas noticias internacionales y globales.",
  de: "Die ultimative Plattform, um die neuesten Filme, Animes und Serien zu schauen und über die aktuellsten internationalen und weltweiten Nachrichten auf dem Laufenden zu bleiben.",
  pt: "A plataforma definitiva para assistir aos últimos filmes, animes e séries, e ficar por dentro das últimas notícias internacionais e mundiais.",
  fr: "La plateforme ultime pour regarder les derniers films, animes et séries, et rester informé des dernières actualités internationales et mondiales.",
  tr: "En son filmleri, animeleri ve dizileri izlemek ve en son uluslararası ve küresel haberlerden haberdar olmak için nihai platform.",
  ja: "最新の映画、アニメ、シリーズを視聴し、最新の国際ニュースをチェックできる究極のプラットフォーム。",
  ko: "최신 영화, 애니메이션, 시리즈를 시청하고 최신 국제 뉴스를 확인할 수 있는 궁극의 플랫폼.",
  hi: "नवीनतम फिल्में, एनीमे और श्रृंखला देखने और नवीनतम अंतर्राष्ट्रीय और वैश्विक समाचारों से अपडेट रहने का अंतिम मंच।",
};

export function SEOHead({
  title,
  description,
  image,
  url,
  type = "website",
  publishedAt,
  modifiedAt,
  tags,
  noIndex = false,
  jsonLd,
}: SEOHeadProps) {
  const { language } = useLanguage();
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const desc = description || DEFAULT_DESCRIPTIONS[language] || DEFAULT_DESCRIPTIONS.en;
  const img = image || DEFAULT_IMAGE;
  const canonical = url || window.location.href;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", desc);
    if (noIndex) setMeta("name", "robots", "noindex, nofollow");
    else setMeta("name", "robots", "index, follow");

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", img);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:locale", language);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);

    if (publishedAt) setMeta("property", "article:published_time", publishedAt);
    if (modifiedAt) setMeta("property", "article:modified_time", modifiedAt);
    if (tags?.length) {
      tags.forEach((tag, i) => setMeta("property", `article:tag:${i}`, tag));
    }

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);

    const existingLd = document.getElementById("seo-jsonld");
    if (existingLd) existingLd.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.id = "seo-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const ld = document.getElementById("seo-jsonld");
      if (ld) ld.remove();
    };
  }, [fullTitle, desc, img, canonical, type, publishedAt, modifiedAt, tags, noIndex, jsonLd, language]);

  return null;
}
