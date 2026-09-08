"use client";

import Link from "next/link";

export default function Page() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Surveys</h1>
      <p className="mt-2 text-stone-600">
        Surveys live on the customer hub. Open a customer, then use the <span className="font-medium">Surveys</span> tab.
      </p>
      <Link href="/app/customers" className="mt-4 inline-block rounded-xl bg-clay px-4 py-2 text-sm text-white">
        Go to Customers
      </Link>
    </div>
  );
}
