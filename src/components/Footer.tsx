import { Link } from "react-router-dom";
import { useSiteLogo } from "@/hooks/useSiteLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdvertisementRenderer } from "@/components/AdvertisementRenderer";

const footerTranslations: Record<string, {
  sections: string; legal: string; contact: string; tagline: string; rights: string;
  links: Record<string, string>; legalLinks: Record<string, string>;
}> = {
  en: {
    sections: "Sections", legal: "Legal", contact: "Contact Us",
    tagline: "Your ultimate destination for movies, series, anime, and sports highlights.",
    rights: "All rights reserved.",
    links: { "/movies": "Movies", "/series": "Series", "/anime": "Anime", "/summaries": "Summaries", "/news": "News", "/articles": "Articles" },
    legalLinks: { "/privacy-policy": "Privacy Policy", "/terms-of-service": "Terms of Service", "/about-us": "About Us", "/contact-us": "Contact Us", "/dmca": "DMCA" },
  },
  ar: {
    sections: "أقسام الموقع", legal: "قانوني", contact: "تواصل معنا",
    tagline: "منصة ترفيهية شاملة للأفلام والمسلسلات والأنيمي وملخصات المباريات.",
    rights: "جميع الحقوق محفوظة.",
    links: { "/movies": "أفلام", "/series": "مسلسلات", "/anime": "أنيمي", "/summaries": "ملخصات", "/news": "أخبار", "/articles": "مقالات" },
    legalLinks: { "/privacy-policy": "سياسة الخصوصية", "/terms-of-service": "شروط الاستخدام", "/about-us": "من نحن", "/contact-us": "اتصل بنا", "/dmca": "DMCA" },
  },
  fr: {
    sections: "Sections", legal: "Juridique", contact: "Nous Contacter",
    tagline: "Votre destination ultime pour les films, séries, anime et résumés sportifs.",
    rights: "Tous droits réservés.",
    links: { "/movies": "Films", "/series": "Séries", "/anime": "Anime", "/summaries": "Résumés", "/news": "Actualités", "/articles": "Articles" },
    legalLinks: { "/privacy-policy": "Politique de Confidentialité", "/terms-of-service": "Conditions d'Utilisation", "/about-us": "À Propos", "/contact-us": "Nous Contacter", "/dmca": "DMCA" },
  },
};

export function Footer() {
  const { logoUrl } = useSiteLogo();
  const { language } = useLanguage();
  const year = new Date().getFullYear();

  const t = footerTranslations[language] || footerTranslations.en;

  return (
    <footer className="mt-16 border-t border-border bg-card/60 backdrop-blur-sm">
      <div className="container mx-auto max-w-7xl px-4 pt-6">
        <AdvertisementRenderer placement="footer" />
      </div>
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoUrl || "/favicon.png"} alt="zarynmovies" className="h-8 w-8 rounded" />
              <span className="text-lg font-bold text-foreground">zarynmovies</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.tagline}</p>
          </div>

          {/* Site links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">{t.sections}</h3>
            <ul className="space-y-2">
              {Object.entries(t.links).map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-primary">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">{t.legal}</h3>
            <ul className="space-y-2">
              {Object.entries(t.legalLinks).map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-primary">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">{t.contact}</h3>
            <a href="mailto:zarynmovies@gmail.com" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              zarynmovies@gmail.com
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          <p>© {year} zarynmovies. {t.rights}</p>
        </div>
      </div>
    </footer>
  );
}
