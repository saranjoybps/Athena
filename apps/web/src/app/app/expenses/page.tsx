"use client";

import Link from "next/link";

export default function Page() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Expenses</h1>
      <p className="mt-2 text-stone-600">
        Expenses are logged on a project. Open a project → <span className="font-medium">Money</span> → Add expense.
      </p>
      <Link href="/app/projects" className="mt-4 inline-block rounded-xl bg-clay px-4 py-2 text-sm text-white">
        Go to Projects
      </Link>
    </div>
  );
}
