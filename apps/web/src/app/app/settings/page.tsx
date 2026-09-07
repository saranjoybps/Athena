"use client";

import { useEffect, useState } from "react";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

const fields = [
  { key: "companyName", label: "Company name" },
  { key: "companyAddress", label: "Company address", multiline: true },
  { key: "gstNumber", label: "GSTIN" },
  { key: "pan", label: "PAN" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "bankName", label: "Bank name" },
  { key: "bankBranch", label: "Bank branch" },
  { key: "bankAccountHolder", label: "Account holder" },
  { key: "bankAccountNumber", label: "Account number" },
  { key: "bankIfscCode", label: "IFSC code" },
  { key: "upiId", label: "UPI ID" },
  { key: "logoUrl", label: "Logo URL" },
  { key: "sealUrl", label: "Seal image URL" },
  { key: "signatureUrl", label: "Signature image URL" },
  { key: "termsConditions", label: "Terms & conditions", multiline: true },
] as const;

export default function Page() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    athena.organization
      .documentBranding()
      .then((data) => {
        setForm({
          companyName: String(data.company_name || ""),
          companyAddress: String(data.company_address || ""),
          gstNumber: String(data.gst_number || ""),
          pan: String(data.pan || ""),
          phone: String(data.phone || ""),
          email: String(data.email || ""),
          bankName: String(data.bank_name || ""),
          bankBranch: String(data.bank_branch || ""),
          bankAccountHolder: String(data.bank_account_holder || ""),
          bankAccountNumber: String(data.bank_account_number || ""),
          bankIfscCode: String(data.bank_ifsc_code || ""),
          upiId: String(data.upi_id || ""),
          logoUrl: String(data.logo_url || ""),
          sealUrl: String(data.seal_url || ""),
          signatureUrl: String(data.signature_url || ""),
          termsConditions: String(data.terms_conditions || ""),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    try {
      await athena.organization.updateDocumentBranding(form);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-stone-600">Configure company branding for quotations and tax invoices.</p>

      {loading ? <p className="mt-6 text-stone-600">Loading…</p> : null}
      {error ? <div className="mt-6"><ErrorState message={error} /></div> : null}

      <form onSubmit={save} className="mt-6 grid max-w-2xl gap-4">
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">{field.label}</span>
            {"multiline" in field && field.multiline ? (
              <textarea
                className="rounded-xl border px-3 py-2"
                rows={3}
                value={form[field.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            ) : (
              <input
                className="rounded-xl border px-3 py-2"
                value={form[field.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
            Save branding
          </button>
          {saved ? <span className="text-sm text-emerald-700">Saved</span> : null}
        </div>
      </form>
    </div>
  );
}
