"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signInDev } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setBusy(true);
    setError(null);
    try {
      await signInDev("local-owner");
      router.push("/app");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sign-in failed. Is the API running, and has demo data been seeded?",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-stone-600">Local demo auth — no password required.</p>

      <div className="mt-4 rounded-2xl border bg-white p-4 text-sm text-stone-700">
        <p className="font-medium text-ink">Demo account</p>
        <p className="mt-2">Business: Athena Demo Contractors</p>
        <p>User: Demo Owner</p>
        <p>Email: demo@athena.local</p>
        <p>User ID: local-owner</p>
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <button
        className="mt-6 w-full rounded-xl bg-clay py-3 text-white disabled:opacity-50"
        disabled={busy}
        onClick={enter}
        type="button"
      >
        {busy ? "Signing in…" : "Continue as demo owner"}
      </button>
      <p className="mt-4 text-sm">
        New contractor?{" "}
        <Link href="/onboarding" className="text-clay">
          Onboard your business
        </Link>
      </p>
    </main>
  );
}
