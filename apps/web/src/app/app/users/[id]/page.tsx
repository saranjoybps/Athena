"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

const MODULES = [
  { value: "admin", label: "Admin", hint: "Users, settings, full control" },
  { value: "home", label: "Home", hint: "Dashboard, customers, projects" },
  { value: "accounts", label: "Accounts", hint: "Invoices, payments, accounting" },
  { value: "inventory", label: "Inventory", hint: "Materials, labour, crews, tools" },
  { value: "field", label: "Field", hint: "Attendance, schedule" },
] as const;

const LEGACY_TO_MODULES: Record<string, string[]> = {
  owner: ["admin", "home", "accounts", "inventory", "field"],
  project_manager: ["home"],
  manager: ["home"],
  accountant: ["accounts"],
  supervisor: ["field"],
  worker: ["field"],
  estimator: ["home"],
};

function rolesToModules(roles: string[]): string[] {
  const out = new Set<string>();
  for (const r of roles) {
    if (MODULES.some((m) => m.value === r)) out.add(r);
    else if (LEGACY_TO_MODULES[r]) LEGACY_TO_MODULES[r].forEach((m) => out.add(m));
  }
  return Array.from(out);
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [modules, setModules] = useState<string[]>(["field"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const res = await athena.users.list();
    const found = res.items.find((u) => String(u.id) === id);
    if (!found) throw new Error("User not found");
    setEmail(String(found.email || ""));
    setName(String(found.name || found.displayName || ""));
    setStatus(String(found.status || "active"));
    const roles = Array.isArray(found.roles) ? found.roles.map(String) : [];
    const modulesFromApi = Array.isArray(found.modules) ? found.modules.map(String) : [];
    setModules(modulesFromApi.length ? modulesFromApi : rolesToModules(roles));
  }, [id]);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setReady(true));
  }, [load]);

  function toggle(mod: string) {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!modules.length) throw new Error("Select at least one access module");
      await athena.users.update(id, {
        name: name || null,
        roles: modules,
        status: status || null,
      });
      router.push("/app/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready && !error) return <p className="text-stone-600">Loading…</p>;
  if (error && !ready) return <ErrorState message={error} />;

  return (
    <div>
      <Link href="/app/users" className="text-sm text-clay">
        ← Users
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit user</h1>
      <p className="mt-1 text-stone-600">{email}</p>

      <form onSubmit={submit} className="mt-6 grid max-w-xl gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Full name</span>
          <input className="rounded-xl border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Status</span>
          <select className="rounded-xl border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="disabled">Disabled</option>
          </select>
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
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
