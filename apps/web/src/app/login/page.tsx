"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signInDev, loading } = useAuth();
  const router = useRouter();

  async function enter() {
    await signInDev("local-owner");
    router.push("/app");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-stone-600">Demo uses dev auth. Configure Firebase for production sign-in.</p>
      <button
        className="mt-6 w-full rounded-xl bg-clay py-3 text-white disabled:opacity-50"
        disabled={loading}
        onClick={enter}
        type="button"
      >
        Continue as demo owner
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
