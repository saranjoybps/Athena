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
  <p class="meta">Last updated: 30 September 2026 · Applies to the Athena mobile and web apps</p>
  <p><a href="/account-deletion"><strong>Delete your Athena account</strong></a></p>

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
  <p>You can delete your Athena account in the mobile app: <strong>More → Delete account</strong>.
  If you no longer have the app, use the public page
  <a href="/account-deletion">Delete your Athena account</a>
  or email <a href="mailto:privacy@athena.app?subject=Athena%20account%20deletion%20request">privacy@athena.app</a>.
  Deletion disables your memberships, removes or anonymizes your user profile,
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

ACCOUNT_DELETION_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Delete your Athena account</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.55;
           max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; color: #1c1917; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    p, li { color: #44403c; }
    a.btn { display: inline-block; margin-top: 0.75rem; background: #c2410c; color: #fff;
            text-decoration: none; padding: 0.7rem 1rem; border-radius: 8px; font-weight: 650; }
    a { color: #c2410c; }
  </style>
</head>
<body>
  <p>Athena</p>
  <h1>Delete your Athena account</h1>
  <p>This page is for the Athena app (Google Play package <strong>io.athena.app</strong>).
  You can request deletion of your Athena account and the personal data tied to it without opening the app.</p>
  <h2>In the app</h2>
  <p>Open Athena, go to <strong>More → Delete account</strong>, and confirm. That signs you out,
  disables workspace access, anonymizes your profile, and deletes the Firebase sign-in account.</p>
  <h2>Without the app</h2>
  <p>Email us from the address on the account. Include the email you use to sign in.
  We delete the account and associated personal data. We do not only freeze or disable the login.</p>
  <p>Business records such as invoices may be kept for a limited time where tax, accounting, or other
  legal duties require it, then deleted or anonymized. Details are in the
  <a href="/privacy">Athena Privacy Policy</a>.</p>
  <p><a class="btn" href="mailto:privacy@athena.app?subject=Athena%20account%20deletion%20request&amp;body=Please%20delete%20my%20Athena%20account.%0A%0ASign-in%20email%3A%20%0A">Request Athena account deletion</a></p>
</body>
</html>
"""
