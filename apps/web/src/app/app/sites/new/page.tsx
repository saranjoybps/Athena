"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { customerHref } from "@/lib/customer-nav";
import { athena, optionsFrom } from "@/lib/athena-client";

function NewSiteForm() {
  const search = useSearchParams();
  const customerId = search.get("customerId") || "";
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
  const [siteCount, setSiteCount] = useState(0);

  useEffect(() => {
    if (!customerId) return;
    athena.customers
      .get(customerId)
      .then(setCustomer)
      .catch(() => setCustomer(null));
    athena.sites
      .list(customerId)
      .then((res) => setSiteCount((res.items || []).length))
      .catch(() => setSiteCount(0));
  }, [customerId]);

  const autoName = useMemo(() => {
    const base = String(customer?.name || "").trim() || "Customer";
    return siteCount > 0 ? `${base} - Site ${siteCount + 1}` : `${base} - Site`;
  }, [customer, siteCount]);

  const fields = useMemo(
    () => [
      {
        key: "customerId",
        label: "Customer",
        type: "relation" as const,
        required: true,
        defaultValue: customerId,
        hidden: Boolean(customerId),
        loadOptions: () => optionsFrom(athena.customers.list),
      },
      { key: "name", label: "Site name", required: true, defaultValue: autoName },
      { key: "address", label: "Site location", type: "textarea" as const, required: true },
      { key: "siteType", label: "Site type", placeholder: "residential / commercial" },
      { key: "accessInstructions", label: "Access instructions", type: "textarea" as const },
      { key: "mapsUrl", label: "Maps URL" },
    ],
    [customerId, autoName],
  );

  const infoPanel =
    customerId && customer ? (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Customer</p>
        <p className="mt-1 font-medium text-stone-900">{String(customer.name || "")}</p>
        <p className="mt-1 text-stone-600">{String(customer.phone || "No phone")}</p>
      </div>
    ) : null;

  const backHref = customerId ? customerHref(customerId, "sites") : "/app/customers";

  return (
    <RecordFormPage
      key={`${customerId}-${autoName}`}
      title="New site"
      subtitle="Job location linked to this customer."
      backHref={backHref}
      backLabel={customerId ? "Customer sites" : "Customers"}
      successHref={backHref}
      infoPanel={infoPanel}
      fields={fields}
      onSubmit={(form) =>
        athena.sites.create({
          customerId: form.customerId || customerId,
          name: form.name,
          address: form.address,
          siteType: form.siteType || null,
          accessInstructions: form.accessInstructions || null,
          mapsUrl: form.mapsUrl || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <NewSiteForm />
    </Suspense>
  );
}
