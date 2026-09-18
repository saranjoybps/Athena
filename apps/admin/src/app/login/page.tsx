"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn, signInDev, unauthorized } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/tenants");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDev() {
    setBusy(true);
    setError(null);
    try {
      await signInDev("local-owner");
      router.replace("/tenants");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not a platform operator");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <p className="text-sm font-semibold text-clay">Athena</p>
      <h1 className="mt-2 text-2xl font-semibold">Platform admin</h1>
      <p className="mt-2 text-stone-600">Sign in with an operator Firebase account.</p>
      {unauthorized ? (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">This account is not a platform operator.</p>
      ) : null}
      <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
        <input className="rounded-xl border px-3 py-3" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded-xl border px-3 py-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="rounded-xl bg-clay py-3 text-white disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "Please wait…" : "Sign in"}
        </button>
      </form>
      <button type="button" className="mt-3 w-full rounded-xl border border-dashed py-3 text-sm" disabled={busy} onClick={onDev}>
        Continue as local operator (dev)
      </button>
    </main>
  );
}
