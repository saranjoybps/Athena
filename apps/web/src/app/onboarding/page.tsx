"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { athena } from "@/lib/athena-client";
import { saveSession } from "@/lib/session";

const trades = [
  "Painting",
  "Plastering",
  "Masonry",
  "Flooring",
  "Tiling",
  "Waterproofing",
  "Roofing",
  "Electrical",
  "Plumbing",
  "Carpentry",
  "False ceiling",
  "Interior",
  "Renovation",
  "General construction",
  "Handyman",
  "Maintenance",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    ownerName: "",
    state: "Tamil Nadu",
    city: "",
    pinCode: "",
    address: "",
    gstin: "",
    selected: ["Painting"] as string[],
  });

  async function submit() {
    setError(null);
    try {
      const userId = form.email || "local-owner";
      const res = await athena.onboarding(
        {
          account: { name: form.name, email: form.email, phone: form.phone },
          business: {
            businessName: form.businessName,
            ownerName: form.ownerName || form.name,
            phone: form.phone,
            email: form.email,
          },
          location: {
            state: form.state,
            city: form.city,
            pinCode: form.pinCode,
            address: form.address,
          },
          config: { gstin: form.gstin || null, gstRegistered: Boolean(form.gstin) },
          trades: form.selected.map((t) => t.toLowerCase()),
          team: [],
        },
        userId,
      ) as { organization: { id: string } };
      saveSession({ userId, orgId: res.organization.id, roles: ["owner"], permissions: ["*"] });
      setOk(true);
      router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <p className="text-sm text-clay">Step {step} of 7</p>
      <h1 className="text-2xl font-semibold">Set up Athena</h1>
      {step === 1 && (
        <div className="mt-4 flex flex-col gap-3">
          <input className="rounded-xl border px-3 py-3" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-xl border px-3 py-3" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-xl border px-3 py-3" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      )}
      {step === 2 && (
        <div className="mt-4 flex flex-col gap-3">
          <input className="rounded-xl border px-3 py-3" placeholder="Business name" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          <input className="rounded-xl border px-3 py-3" placeholder="Owner name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        </div>
      )}
      {step === 3 && (
        <div className="mt-4 flex flex-col gap-3">
          <input className="rounded-xl border px-3 py-3" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="rounded-xl border px-3 py-3" placeholder="PIN code" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} />
          <input className="rounded-xl border px-3 py-3" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      )}
      {step === 4 && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-stone-600">Currency INR · Time zone Asia/Kolkata</p>
          <input className="rounded-xl border px-3 py-3" placeholder="GSTIN (optional)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
        </div>
      )}
      {step === 5 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {trades.map((t) => {
            const on = form.selected.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    selected: on ? form.selected.filter((x) => x !== t) : [...form.selected, t],
                  })
                }
                className={`rounded-xl border px-3 py-2 text-left text-sm ${on ? "border-clay bg-orange-50" : ""}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
      {step === 6 && <p className="mt-4 text-stone-600">Invite managers, estimators, accountants, and workers after you finish. Templates provision automatically.</p>}
      {step === 7 && <p className="mt-4 text-stone-600">We will copy painting work items, materials, labour categories, and formulas into your organization.</p>}
      {error ? <p className="mt-3 text-red-700">{error}</p> : null}
      {ok ? <p className="mt-3 text-green-800">Business created. Go to the app home.</p> : null}
      <div className="mt-6 flex gap-3">
        {step > 1 ? (
          <button className="rounded-xl border px-4 py-3" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : null}
        {step < 7 ? (
          <button className="rounded-xl bg-clay px-4 py-3 text-white" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button className="rounded-xl bg-clay px-4 py-3 text-white" onClick={submit}>
            Finish
          </button>
        )}
      </div>
    </main>
  );
}
