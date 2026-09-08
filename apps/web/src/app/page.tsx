import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-8">
      <div>
        <p className="text-clay font-semibold">Athena</p>
        <h1 className="mt-2 text-3xl font-semibold">The operating system for Indian contractors.</h1>
        <p className="mt-3 text-stone-600">
          Measure, calculate, quote, execute, bill, and know your profit. Not a CRM.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-xl bg-clay px-4 py-3 text-white">
          Sign in
        </Link>
        <Link href="/login" className="rounded-xl border border-stone-300 px-4 py-3">
          Create account
        </Link>
      </div>
    </main>
  );
}
