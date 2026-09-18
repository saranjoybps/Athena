"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/shell";
import { useAdminAuth } from "@/lib/auth";
import { platform, type UpgradeRequest } from "@/lib/api";

export default function UpgradeInboxPage() {
  const { session } = useAdminAuth();
  const [items, setItems] = useState<UpgradeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!session?.token) return;
    const res = await platform.upgradeRequests(session.token, "pending");
    setItems(res.items || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [session?.token]);

  async function act(id: string, kind: "accept" | "reject") {
    if (!session?.token) return;
    setError(null);
    try {
      if (kind === "accept") await platform.acceptUpgrade(session.token, id);
      else await platform.rejectUpgrade(session.token, id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminShell pendingCount={items.length}>
      <h1 className="text-2xl font-semibold">Upgrade requests</h1>
      <p className="text-sm text-stone-600">Accept converts the workspace to paid starter.</p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? <p className="text-stone-500">No pending requests.</p> : null}
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/tenants/${r.org_id}`} className="font-medium text-clay">
                  {r.org_name || r.org_id}
                </Link>
                <p className="text-sm text-stone-600">{r.owner_email}</p>
                {r.message ? <p className="mt-1 text-sm">{r.message}</p> : null}
              </div>
              <div className="flex gap-2">
                <button type="button" className="rounded-xl bg-clay px-3 py-2 text-sm text-white" onClick={() => act(r.id, "accept")}>
                  Accept
                </button>
                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => act(r.id, "reject")}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
