"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/shell";
import { useAdminAuth } from "@/lib/auth";
import { platform } from "@/lib/api";
import { usePendingUpgrades } from "@/lib/pending";

export default function NewTenantPage() {
  const { session } = useAdminAuth();
  const pending = usePendingUpgrades();
  const router = useRouter();
  const [trial, setTrial] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", owner_email: "", owner_name: "", temporary_password: "" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session?.token) return;
    setBusy(true);
    setError(null);
    try {
      const created = (await platform.createTenant(session.token, {
        ...form,
        trial,
        plan: trial ? "free" : "starter",
      })) as { tenant?: { id: string } };
      router.push(`/tenants/${created.tenant?.id || ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell pendingCount={pending}>
      <Link href="/tenants" className="text-sm text-clay">
        ← Tenants
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">New tenant</h1>
      <form className="mt-6 grid max-w-lg gap-3" onSubmit={onSubmit}>
        <input className="rounded-xl border px-3 py-2" placeholder="Company name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" placeholder="Owner name" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" type="email" placeholder="Owner email" required value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
        <input className="rounded-xl border px-3 py-2" placeholder="Temporary password (optional)" value={form.temporary_password} onChange={(e) => setForm({ ...form, temporary_password: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={trial} onChange={(e) => setTrial(e.target.checked)} />
          15-day trial (default on)
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="w-fit rounded-xl bg-clay px-4 py-2 text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Provisioning…" : "Create tenant"}
        </button>
      </form>
    </AdminShell>
  );
}
