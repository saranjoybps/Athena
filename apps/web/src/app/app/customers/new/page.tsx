"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/states";
import { fabrica } from "@/lib/fabrica-client";

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await fabrica.customers.create(form);
      router.push("/app/customers");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader title="New customer" subtitle="Customers exist to support projects, not a sales pipeline." />
      <form className="max-w-lg space-y-3 rounded-2xl bg-white p-5" onSubmit={(e) => e.preventDefault()}>
        <input className="w-full rounded-xl border px-3 py-3" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full rounded-xl border px-3 py-3" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="w-full rounded-xl border px-3 py-3" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        {error ? <p className="text-red-700">{error}</p> : null}
        <button className="rounded-xl bg-clay px-4 py-3 text-white" type="button" onClick={save}>
          Save
        </button>
      </form>
    </>
  );
}
