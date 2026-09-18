"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/shell";
import { useAdminAuth } from "@/lib/auth";
import { platform } from "@/lib/api";
import { usePendingUpgrades } from "@/lib/pending";

export default function SettingsPage() {
  const { session } = useAdminAuth();
  const pending = usePendingUpgrades();
  const [raw, setRaw] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session?.token) return;
    platform
      .settings(session.token)
      .then((s) => setRaw(JSON.stringify(s, null, 2)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [session?.token]);

  async function save() {
    if (!session?.token) return;
    setError(null);
    setSaved(false);
    try {
      const parsed = JSON.parse(raw);
      await platform.saveSettings(session.token, parsed);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  return (
    <AdminShell pendingCount={pending}>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-stone-600">Platform app settings. No email or billing integrations.</p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-green-700">Saved.</p> : null}
      <textarea className="mt-4 h-80 w-full max-w-2xl rounded-2xl border p-3 font-mono text-sm" value={raw} onChange={(e) => setRaw(e.target.value)} />
      <div>
        <button type="button" className="mt-3 rounded-xl bg-clay px-4 py-2 text-white" onClick={save}>
          Save
        </button>
      </div>
    </AdminShell>
  );
}
