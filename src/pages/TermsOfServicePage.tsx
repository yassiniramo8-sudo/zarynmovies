import { DynamicLegalPage } from "@/components/DynamicLegalPage";

const FALLBACK = `<p>By using <strong>zarynmovies</strong>, you agree to comply with the following Terms of Service. Please read them carefully before using the website.</p>

<h2>1. Acceptance of Terms</h2>
<p>By accessing and using this website, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and all applicable laws and regulations.</p>

<h2>2. Use of the Website</h2>
<ul>
  <li>This website is intended for personal and non-commercial use only.</li>
  <li>You may not copy, reproduce, distribute, or republish any content from this website without prior written permission.</li>
  <li>You agree not to use the website for any unlawful or prohibited activities.</li>
  <li>You must not attempt to gain unauthorized access to any part of the website or its systems.</li>
</ul>

<h2>3. User Accounts</h2>
<p>When you create an account on zarynmovies, you are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

<h2>4. Content and Intellectual Property</h2>
<p>All content on this website, including text, images, graphics, logos, and software, is the property of zarynmovies or its content suppliers and is protected by international copyright laws.</p>

<h2>5. User-Generated Content</h2>
<p>By posting comments, reviews, or other content on the website, you grant zarynmovies a non-exclusive, royalty-free, worldwide license to use, display, and distribute such content.</p>

<h2>6. Disclaimer of Warranties</h2>
<p>The website is provided "as is" without warranties of any kind. We do not guarantee that the website will be error-free, secure, or uninterrupted.</p>

<h2>7. Limitation of Liability</h2>
<p>zarynmovies shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the website.</p>

<h2>8. Modifications</h2>
<p>We reserve the right to modify these terms at any time. Changes will be effective upon posting to this page. Your continued use constitutes acceptance of the updated terms.</p>

<h2>9. Contact Us</h2>
<p>For any questions regarding these terms, please contact us at: <a href="mailto:zarynmovies@gmail.com">zarynmovies@gmail.com</a></p>

<p><em>These terms may be updated to include new laws or regulations as applicable.</em></p>`;

export default function TermsOfServicePage() {
  return (
    <DynamicLegalPage
      pageKey="terms_of_service"
      fallbackTitle="Terms of Service"
      fallbackDescription="Terms of Service for zarynmovies - Please read these terms carefully before using the website."
      fallbackContent={FALLBACK}
    />
  );
}
