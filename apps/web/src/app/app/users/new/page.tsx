"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";
import { QuotaGuard } from "@/components/quota-guard";
import { athena } from "@/lib/athena-client";

const MODULES = [
  { value: "admin", label: "Admin", hint: "Users, settings, full control" },
  { value: "home", label: "Home", hint: "Dashboard, customers, projects" },
  { value: "accounts", label: "Accounts", hint: "Invoices, payments, accounting" },
  { value: "inventory", label: "Inventory", hint: "Materials, labour, crews, tools" },
  { value: "field", label: "Field", hint: "Attendance, schedule" },
] as const;

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [modules, setModules] = useState<string[]>(["field"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(mod: string) {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!modules.length) throw new Error("Select at least one access module");
      await athena.users.invite({
        email,
        name,
        roles: modules,
        temporaryPassword: temporaryPassword || null,
      });
      router.push("/app/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <QuotaGuard metric="users">
    <div>
      <Link href="/app/users" className="text-sm text-clay">
        ← Users
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Invite user</h1>
      <p className="mt-1 text-stone-600">Choose which areas of the app this person can access.</p>

      <form onSubmit={submit} className="mt-6 grid max-w-xl gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Full name *</span>
          <input className="rounded-xl border px-3 py-2" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Email *</span>
          <input
            type="email"
            className="rounded-xl border px-3 py-2"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Temporary password (optional)</span>
          <input
            className="rounded-xl border px-3 py-2"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
          />
        </label>

        <fieldset className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-4">
          <legend className="px-1 text-sm font-medium text-stone-700">Access</legend>
          {MODULES.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={modules.includes(m.value)}
                onChange={() => toggle(m.value)}
              />
              <span>
                <span className="font-medium text-stone-900">{m.label}</span>
                <span className="mt-0.5 block text-stone-500">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error ? <ErrorState message={error} /> : null}
        <button type="submit" disabled={busy} className="w-fit rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Inviting…" : "Invite user"}
        </button>
      </form>
    </div>
    </QuotaGuard>
  );
}
