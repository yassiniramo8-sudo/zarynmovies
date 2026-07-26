import { DynamicLegalPage } from "@/components/DynamicLegalPage";

const FALLBACK = `<p>Welcome to <strong>zarynmovies</strong>, a dedicated platform for movie, TV series, and anime enthusiasts, as well as sports highlights and entertainment news.</p>

<h2>Our Vision</h2>
<p>We strive to become the premier destination for entertainment content, offering comprehensive coverage of the latest movies, series, anime, and sports events from around the world.</p>

<h2>What We Offer</h2>
<ul>
  <li><strong>Movies:</strong> In-depth reviews, detailed information, trailers, and ratings for the latest and classic films.</li>
  <li><strong>TV Series:</strong> Episode tracking, season guides, and comprehensive series information.</li>
  <li><strong>Anime:</strong> A rich library of the best anime titles with episode tracking and community engagement.</li>
  <li><strong>Sports Highlights:</strong> Comprehensive coverage of the most important football matches and sporting events.</li>
  <li><strong>Entertainment News:</strong> Stay updated with the latest news from the world of cinema, television, and entertainment.</li>
</ul>

<h2>Our Mission</h2>
<p>At zarynmovies, we are committed to providing a high-quality, user-friendly platform that brings together entertainment lovers from all backgrounds. We believe in delivering accurate, engaging, and up-to-date content that enhances your entertainment experience.</p>

<h2>Contact Us</h2>
<p>We value your feedback and suggestions. Reach out to us at: <a href="mailto:zarynmovies@gmail.com">zarynmovies@gmail.com</a></p>`;

export default function AboutUsPage() {
  return (
    <DynamicLegalPage
      pageKey="about_us"
      fallbackTitle="About Us"
      fallbackDescription="Learn about zarynmovies - A dedicated platform for movie, TV series, anime, and sports highlights enthusiasts."
      fallbackContent={FALLBACK}
    />
  );
}
