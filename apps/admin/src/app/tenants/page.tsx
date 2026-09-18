"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/shell";
import { useAdminAuth } from "@/lib/auth";
import { platform, type Tenant } from "@/lib/api";
import { usePendingUpgrades } from "@/lib/pending";

export default function TenantsPage() {
  const { session } = useAdminAuth();
  const pending = usePendingUpgrades();
  const [items, setItems] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!session?.token) return;
    const res = await platform.tenants(session.token);
    setItems(res.items || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [session?.token]);

  const filtered = useMemo(
    () =>
      items.filter((t) => {
        const q = search.toLowerCase();
        const match =
          !q ||
          t.name?.toLowerCase().includes(q) ||
          t.owner_email?.toLowerCase().includes(q) ||
          t.id?.toLowerCase().includes(q);
        return match && (!status || t.status === status);
      }),
    [items, search, status],
  );

  async function act(id: string, fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <AdminShell pendingCount={pending}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-stone-600">{items.length} workspaces</p>
        </div>
        <Link href="/tenants/new" className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          New tenant
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-sand text-stone-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Days left</th>
              <th className="px-3 py-2">Usage</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-clay">
                    {t.name}
                  </Link>
                  <div className="text-xs text-stone-500">{t.owner_email}</div>
                </td>
                <td className="px-3 py-2">
                  {t.status}
                  {t.upgrade_request_pending ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Upgrade</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{t.plan}</td>
                <td className="px-3 py-2">{t.status === "trial" ? t.days_remaining ?? "—" : "—"}</td>
                <td className="px-3 py-2 text-xs text-stone-600">
                  {t.usage?.users ?? 0}/{t.limits?.users || "∞"} users
                </td>
                <td className="px-3 py-2 text-right">
                  {t.upgrade_request_pending ? (
                    <Link href="/upgrade-requests" className="mr-2 text-clay">
                      Accept
                    </Link>
                  ) : null}
                  {t.status === "suspended" ? (
                    <button type="button" className="text-clay" onClick={() => act(t.id, () => platform.reactivate(session!.token, t.id))}>
                      Reactivate
                    </button>
                  ) : (
                    <button type="button" className="text-stone-600" onClick={() => act(t.id, () => platform.suspend(session!.token, t.id))}>
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
