"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
    if (!loading && session && !session.orgId) router.replace("/onboarding");
  }, [loading, session, router]);

  if (loading || !session?.orgId) {
    return <div className="p-8 text-stone-600">Loading workspace…</div>;
  }

  return (
    <div className="flex min-h-dvh">
      <AppNav />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 text-sm md:px-8">
          <span className="text-stone-600">{session.orgName || "Workspace"}</span>
          <div className="flex gap-3">
            <Link href="/field" className="text-clay">
              Field app
            </Link>
            <button type="button" onClick={signOut} className="text-stone-600">
              Sign out
            </button>
          </div>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
