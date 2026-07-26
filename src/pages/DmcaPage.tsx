import { DynamicLegalPage } from "@/components/DynamicLegalPage";

const FALLBACK = `<p><strong>zarynmovies</strong> is committed to respecting intellectual property rights and the copyrights of others. We comply with the Digital Millennium Copyright Act (DMCA) and respond promptly to valid notices of alleged infringement.</p>

<h2>1. Our Copyright Policy</h2>
<p>We do not claim ownership of any copyrighted content displayed on this website. All movie posters, images, trailers, and related media are the property of their respective owners and are used under fair use guidelines for informational and review purposes.</p>

<h2>2. Filing a DMCA Takedown Notice</h2>
<p>If you believe that content on zarynmovies infringes upon your copyright, please submit a written DMCA takedown notice to us including:</p>
<ul>
  <li>Your full legal name and contact information.</li>
  <li>A description of the copyrighted work that you claim has been infringed.</li>
  <li>The specific URL(s) or location of the infringing material on our website.</li>
  <li>A statement that you have a good faith belief that the use is not authorized by the copyright owner.</li>
  <li>A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on their behalf.</li>
  <li>Your physical or electronic signature.</li>
</ul>

<h2>3. Where to Send Your Notice</h2>
<p>Please send all DMCA notices to: <a href="mailto:zarynmovies@gmail.com">zarynmovies@gmail.com</a></p>

<h2>4. Processing Time</h2>
<p>We review all DMCA takedown notices within <strong>48-72 hours</strong> and will take appropriate action, including removing or disabling access to the allegedly infringing content.</p>

<h2>5. Counter-Notification</h2>
<p>If you believe your content was removed in error, you may submit a counter-notification with the required information as outlined by the DMCA.</p>

<h2>6. Repeat Infringers</h2>
<p>We maintain a policy of terminating accounts of users who are repeat copyright infringers in appropriate circumstances.</p>

<p><em>This policy may be updated to reflect changes in copyright law or regulations.</em></p>`;

export default function DmcaPage() {
  return (
    <DynamicLegalPage
      pageKey="dmca"
      fallbackTitle="DMCA Copyright Policy"
      fallbackDescription="DMCA Copyright Policy for zarynmovies - We respect intellectual property rights and respond to valid takedown notices."
      fallbackContent={FALLBACK}
    />
  );
}
