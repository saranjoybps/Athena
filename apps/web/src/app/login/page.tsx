"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, session } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function afterAuth(next: { orgId: string | null }) {
    router.push(next.orgId ? "/app" : "/onboarding");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next =
        mode === "signup"
          ? await signUpWithEmail(name, email, password)
          : await signInWithEmail(email, password);
      await afterAuth(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      const next = await signInWithGoogle();
      await afterAuth(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (session?.orgId) {
    router.replace("/app");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-stone-600">
        Use your email or Google. New accounts set up a business next.
      </p>

      <div className="mt-6 flex gap-2 rounded-xl bg-stone-100 p-1">
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === "signin" ? "bg-white shadow-sm" : "text-stone-600"}`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === "signup" ? "bg-white shadow-sm" : "text-stone-600"}`}
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
      </div>

      <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmit}>
        {mode === "signup" ? (
          <input
            className="rounded-xl border px-3 py-3"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        ) : null}
        <input
          className="rounded-xl border px-3 py-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="rounded-xl border px-3 py-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          className="w-full rounded-xl bg-clay py-3 text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-sm text-stone-400">
        <div className="h-px flex-1 bg-stone-200" />
        or
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <button
        type="button"
        className="w-full rounded-xl border border-stone-300 bg-white py-3 font-medium disabled:opacity-50"
        disabled={busy}
        onClick={onGoogle}
      >
        Continue with Google
      </button>

      <p className="mt-6 text-sm text-stone-600">
        Already signed in without a business?{" "}
        <Link href="/onboarding" className="text-clay">
          Finish onboarding
        </Link>
      </p>
    </main>
  );
}
