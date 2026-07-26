import { DynamicLegalPage } from "@/components/DynamicLegalPage";

const FALLBACK = `<p>If you have any questions, suggestions, or feedback about <strong>zarynmovies</strong>, you can reach out to us at any time. We are here to help!</p>

<h2>How to Reach Us</h2>
<p><strong>Email:</strong> <a href="mailto:zarynmovies@gmail.com">zarynmovies@gmail.com</a></p>
<p>You can also use our <a href="/contact">Contact Form</a> for a quick and easy way to get in touch.</p>

<h2>Response Time</h2>
<p>We strive to respond to all inquiries within <strong>24-48 hours</strong>. For urgent matters, please include "URGENT" in the subject line of your email.</p>

<h2>Feedback and Suggestions</h2>
<p>We value your input! If you have ideas for improving our platform or content, we would love to hear from you. Your feedback helps us grow and serve you better.</p>

<h2>Report an Issue</h2>
<p>If you encounter any technical issues, broken links, or content errors on the website, please let us know and we will address them promptly.</p>`;

export default function ContactUsPage() {
  return (
    <DynamicLegalPage
      pageKey="contact_us"
      fallbackTitle="Contact Us"
      fallbackDescription="Contact the zarynmovies team - We are here to answer your questions and hear your feedback."
      fallbackContent={FALLBACK}
    />
  );
}
