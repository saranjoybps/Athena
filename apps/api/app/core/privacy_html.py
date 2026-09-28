"""Public Privacy Policy HTML for Play Console / in-app linking."""

PRIVACY_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Athena Privacy Policy</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.55;
           max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; color: #1c1917; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.15rem; margin-top: 1.75rem; }
    p, li { color: #44403c; }
    .meta { color: #78716c; font-size: 0.9rem; margin-bottom: 1.5rem; }
    a { color: #c2410c; }
  </style>
</head>
<body>
  <h1>Athena Privacy Policy</h1>
  <p class="meta">Last updated: 24 September 2026 · Applies to the Athena mobile and web apps</p>

  <p>Athena (“we”, “us”) provides contractor operations software (customers, sites, estimates,
  projects, invoices, attendance, and related field tools). This policy describes how we collect,
  use, share, store, and delete personal data.</p>

  <h2>1. Data we collect</h2>
  <ul>
    <li><strong>Account data</strong>: name, email address, authentication identifiers (via Firebase Auth).</li>
    <li><strong>Business data</strong>: company/workspace name, customers, sites, projects, estimates,
        invoices, payments, attendance, labour, and related operational records you enter.</li>
    <li><strong>Location</strong>: approximate or precise location when you use site-map features (with permission).</li>
    <li><strong>Photos / files</strong>: site proof photos and documents you upload (e.g. via Cloudinary).</li>
    <li><strong>Device / technical</strong>: IP address, app version, and basic request logs needed to operate the service.</li>
  </ul>

  <h2>2. How we use data</h2>
  <p>We use data to provide and improve Athena: authenticate users, sync workspace records, generate
  PDFs/quotes/invoices, support field workflows, secure the service, and communicate about account
  or service issues. We do not sell personal data.</p>

  <h2>3. Sharing</h2>
  <p>We share data only with processors needed to run Athena, including:</p>
  <ul>
    <li>Firebase Authentication (Google) for sign-in</li>
    <li>Cloud hosting / database providers for the Athena API</li>
    <li>Cloudinary (or similar) for image/document storage when you upload media</li>
  </ul>
  <p>We may disclose information if required by law or to protect the rights and safety of users.</p>

  <h2>4. Storage &amp; security</h2>
  <p>Data is stored on cloud infrastructure with access controls and HTTPS in transit.
  Passwords are handled by Firebase Auth and are not stored by Athena in plain text.
  No method of transmission or storage is 100% secure; we take reasonable measures to protect data.</p>

  <h2>5. Retention</h2>
  <p>Account credentials and profile data are kept while your account is active.
  After account deletion, authentication access is removed promptly.
  Business operational records (e.g. invoices) may be retained for a limited period where needed
  for legitimate business, tax, or legal purposes, then deleted or anonymized.</p>

  <h2>6. Account &amp; data deletion</h2>
  <p>You can request deletion from the Athena mobile app: <strong>More → Delete account</strong>
  (or contact us below). Deletion disables your memberships, removes or anonymizes your user profile,
  and deletes your Firebase authentication account so you can no longer sign in.
  Some workspace business records may remain for the retention window described above.</p>

  <h2>7. Children’s privacy</h2>
  <p>Athena is designed for business users and is not directed at children under 13
  (or the equivalent age in your jurisdiction).</p>

  <h2>8. Contact</h2>
  <p>Questions or deletion requests: <a href="mailto:privacy@athena.app">privacy@athena.app</a>
  (or your Athena account administrator).</p>
</body>
</html>
"""
