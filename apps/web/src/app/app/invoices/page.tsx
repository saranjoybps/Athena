"use client";

import Link from "next/link";

export default function Page() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="mt-2 text-stone-600">
        Invoices are created from a project. Open a project → <span className="font-medium">Money</span> → Create invoice.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/app/projects" className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Go to Projects
        </Link>
        <Link href="/app/accounting?tab=receivables" className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm">
          Accounts receivables
        </Link>
      </div>
    </div>
  );
}
