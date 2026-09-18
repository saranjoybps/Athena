"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdminAuth } from "@/lib/auth";

const NAV = [
  { href: "/tenants", label: "Tenants" },
  { href: "/upgrade-requests", label: "Upgrade requests" },
  { href: "/settings", label: "Settings" },
];

export function AdminShell({ children, pendingCount = 0 }: { children: React.ReactNode; pendingCount?: number }) {
  const { session, loading, signOut } = useAdminAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return <div className="p-8 text-stone-600">Loading operator console…</div>;
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="w-56 border-r bg-white p-4">
        <p className="text-sm font-semibold text-clay">Athena Admin</p>
        <nav className="mt-6 grid gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 ${path.startsWith(item.href) ? "bg-sand font-medium" : "text-stone-600"}`}
            >
              {item.label}
              {item.href === "/upgrade-requests" && pendingCount > 0 ? (
                <span className="ml-2 rounded-full bg-clay px-2 py-0.5 text-xs text-white">{pendingCount}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={() => signOut()} className="mt-8 text-sm text-stone-500">
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
