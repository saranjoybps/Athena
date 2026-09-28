export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-stone-800">
      <p className="text-clay font-semibold">Athena</p>
      <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated: 24 September 2026</p>

      <section className="mt-8 space-y-4 text-stone-600 leading-relaxed">
        <p>
          Athena provides contractor operations software (customers, sites, estimates, projects,
          invoices, attendance, and related field tools). This policy describes how we collect,
          use, share, store, and delete personal data.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">1. Data we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account data</strong>: name, email address, authentication identifiers (via
            Firebase Auth).
          </li>
          <li>
            <strong>Business data</strong>: company/workspace name, customers, sites, projects,
            estimates, invoices, payments, attendance, labour, and related operational records you
            enter.
          </li>
          <li>
            <strong>Location</strong>: approximate or precise location when you use site-map
            features (with permission).
          </li>
          <li>
            <strong>Photos / files</strong>: site proof photos and documents you upload.
          </li>
          <li>
            <strong>Device / technical</strong>: IP address, app version, and basic request logs
            needed to operate the service.
          </li>
        </ul>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">2. How we use data</h2>
        <p>
          We use data to provide and improve Athena: authenticate users, sync workspace records,
          generate PDFs/quotes/invoices, support field workflows, secure the service, and
          communicate about account or service issues. We do not sell personal data.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">3. Sharing</h2>
        <p>We share data only with processors needed to run Athena, including:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Firebase Authentication (Google) for sign-in</li>
          <li>Cloud hosting / database providers for the Athena API</li>
          <li>Cloudinary (or similar) for image/document storage when you upload media</li>
        </ul>
        <p>
          We may disclose information if required by law or to protect the rights and safety of
          users.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">4. Storage &amp; security</h2>
        <p>
          Data is stored on cloud infrastructure with access controls and HTTPS in transit.
          Passwords are handled by Firebase Auth and are not stored by Athena in plain text.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">5. Retention</h2>
        <p>
          Account credentials and profile data are kept while your account is active. After account
          deletion, authentication access is removed promptly. Business operational records (e.g.
          invoices) may be retained for a limited period where needed for legitimate business, tax,
          or legal purposes, then deleted or anonymized.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">6. Account &amp; data deletion</h2>
        <p>
          You can request deletion from the Athena mobile app: <strong>More → Delete account</strong>
          , or contact us below. Deletion disables your memberships, removes or anonymizes your user
          profile, and deletes your Firebase authentication account so you can no longer sign in.
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">7. Children&apos;s privacy</h2>
        <p>
          Athena is designed for business users and is not directed at children under 13 (or the
          equivalent age in your jurisdiction).
        </p>

        <h2 className="pt-4 text-lg font-semibold text-stone-800">8. Contact</h2>
        <p>
          Questions or deletion requests:{" "}
          <a className="text-clay underline" href="mailto:privacy@athena.app">
            privacy@athena.app
          </a>
          .
        </p>
      </section>
    </main>
  );
}
