import { DynamicLegalPage } from "@/components/DynamicLegalPage";

const FALLBACK = `<p>At <strong>zarynmovies</strong>, we respect the privacy of our visitors and are committed to protecting their personal information. This Privacy Policy explains how we collect, use, and protect information when you visit our website.</p>

<h2>1. Information We Collect</h2>
<p>We may collect the following types of information:</p>
<ul>
  <li><strong>Personal Information:</strong> Such as your name, email address, and username when you register an account.</li>
  <li><strong>Usage Data:</strong> Including your IP address, browser type, operating system, referring URLs, pages viewed, and the date and time of your visit.</li>
  <li><strong>Cookies:</strong> We use cookies and similar tracking technologies to enhance your browsing experience, remember your preferences, and analyze site traffic.</li>
</ul>

<h2>2. How We Use Your Information</h2>
<p>We use the collected information for the following purposes:</p>
<ul>
  <li>To provide, maintain, and improve our website and services.</li>
  <li>To personalize your experience and deliver relevant content.</li>
  <li>To communicate with you regarding updates, notifications, or support.</li>
  <li>To detect, prevent, and address security issues or fraud.</li>
  <li>To comply with legal obligations and enforce our policies.</li>
</ul>

<h2>3. Cookies and Tracking Technologies</h2>
<p>Our website uses cookies to improve user experience. You can control or disable cookies through your browser settings. However, disabling cookies may limit some features of the site.</p>

<h2>4. Third-Party Services</h2>
<p>We may use third-party services such as Google Analytics and Google AdSense that collect, monitor, and analyze user data. These services have their own privacy policies governing the use of your information.</p>

<h2>5. Data Security</h2>
<p>We implement industry-standard security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>

<h2>6. Children's Privacy</h2>
<p>Our website is not intended for children under 13. We do not knowingly collect personal information from children.</p>

<h2>7. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with the updated date. We encourage you to review this page periodically.</p>

<h2>8. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:zarynmovies@gmail.com">zarynmovies@gmail.com</a></p>

<p><em>This policy may be updated to include new laws or regulations as applicable.</em></p>`;

export default function PrivacyPolicyPage() {
  return (
    <DynamicLegalPage
      pageKey="privacy_policy"
      fallbackTitle="Privacy Policy"
      fallbackDescription="Privacy Policy for zarynmovies - We respect the privacy of our visitors and are committed to protecting their personal information."
      fallbackContent={FALLBACK}
    />
  );
}
