"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/shell";
import { useAdminAuth } from "@/lib/auth";
import { platform, type TenantDetail, type TenantUser } from "@/lib/api";
import { usePendingUpgrades } from "@/lib/pending";

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAdminAuth();
  const pending = usePendingUpgrades();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState({ max_users: 0, max_customers: 0, max_sites: 0 });
  const [invite, setInvite] = useState({ email: "", name: "", role: "field" });

  async function reload() {
    if (!session?.token || !id) return;
    const [t, u] = await Promise.all([platform.tenant(session.token, id), platform.users(session.token, id)]);
    setTenant(t);
    setUsers(u.items || []);
    const rl = t.rate_limits || {};
    setLimits({
      max_users: Number(rl.max_users ?? t.limits?.users ?? 0),
      max_customers: Number(rl.max_customers ?? t.limits?.customers ?? 0),
      max_sites: Number(rl.max_sites ?? t.limits?.sites ?? 0),
    });
  }

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [session?.token, id]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!tenant) {
    return (
      <AdminShell pendingCount={pending}>
        <p className="text-stone-600">{error || "Loading…"}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell pendingCount={pending}>
      <Link href="/tenants" className="text-sm text-clay">
        ← Tenants
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{tenant.name}</h1>
      <p className="text-sm text-stone-600">
        {tenant.status} · {tenant.plan} · {tenant.owner_email}
        {tenant.days_remaining != null ? ` · ${tenant.days_remaining} days left` : ""}
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-xl bg-clay px-3 py-2 text-sm text-white" onClick={() => run(() => platform.convert(session!.token, id, { to: "paid", plan: "starter" }))}>
          Convert to paid
        </button>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => run(() => platform.convert(session!.token, id, { to: "trial" }))}>
          Convert to trial
        </button>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => run(() => platform.extendTrial(session!.token, id, 15))}>
          Extend trial 15d
        </button>
        {tenant.status === "suspended" ? (
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => run(() => platform.reactivate(session!.token, id))}>
            Reactivate
          </button>
        ) : (
          <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => run(() => platform.suspend(session!.token, id))}>
            Suspend
          </button>
        )}
      </div>

      <section className="mt-8 max-w-xl rounded-2xl border bg-white p-4">
        <h2 className="font-medium">Usage and limits</h2>
        <p className="text-xs text-stone-500">0 = unlimited. Caps apply even on paid plans.</p>
        <p className="mt-2 text-sm text-stone-600">
          Users {tenant.usage?.users ?? 0}/{limits.max_users || "∞"} · Customers {tenant.usage?.customers ?? 0}/
          {limits.max_customers || "∞"} · Sites {tenant.usage?.sites ?? 0}/{limits.max_sites || "∞"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["max_users", "max_customers", "max_sites"] as const).map((key) => (
            <label key={key} className="text-xs text-stone-600">
              {key.replace("max_", "")}
              <input
                className="mt-1 w-full rounded-lg border px-2 py-1"
                type="number"
                value={limits[key]}
                onChange={(e) => setLimits({ ...limits, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl bg-clay px-3 py-2 text-sm text-white"
          onClick={() =>
            run(() =>
              platform.patchTenant(session!.token, id, {
                rate_limits: { requests_per_minute: 120, ...limits },
              }),
            )
          }
        >
          Save limits
        </button>
      </section>

      <section className="mt-8 max-w-xl rounded-2xl border bg-white p-4">
        <h2 className="font-medium">Users</h2>
        <ul className="mt-2 text-sm">
          {users.map((u) => (
            <li key={u.id} className="border-b py-2 last:border-0">
              {u.name || u.email} · {u.email} · {(u.roles || []).join(", ")}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2">
          <input className="rounded-xl border px-3 py-2" placeholder="Name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          <input className="rounded-xl border px-3 py-2" placeholder="Email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          <button
            type="button"
            className="w-fit rounded-xl bg-clay px-3 py-2 text-sm text-white"
            onClick={() =>
              run(async () => {
                await platform.createUser(session!.token, id, invite);
                setInvite({ email: "", name: "", role: "field" });
              })
            }
          >
            Add user
          </button>
        </div>
      </section>
    </AdminShell>
  );
}
