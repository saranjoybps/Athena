"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { entityBackHref } from "@/lib/customer-nav";
import { athena, optionsFrom } from "@/lib/athena-client";

function NewSurveyForm() {
  const search = useSearchParams();
  const presetSiteId = search.get("siteId") || "";
  const presetCustomerId = search.get("customerId") || "";
  const [customerId, setCustomerId] = useState(presetCustomerId);
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
  const [ready, setReady] = useState(!presetSiteId);

  useEffect(() => {
    if (!presetSiteId) {
      setReady(true);
      return;
    }
    athena.sites
      .get(presetSiteId)
      .then((s) => {
        setCustomerId(String(s.customerId || presetCustomerId));
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [presetSiteId, presetCustomerId]);

  useEffect(() => {
    const cid = customerId || presetCustomerId;
    if (!cid) {
      setCustomer(null);
      return;
    }
    athena.customers
      .get(cid)
      .then(setCustomer)
      .catch(() => setCustomer(null));
  }, [customerId, presetCustomerId]);

  const lockedCustomer = Boolean(presetSiteId || presetCustomerId);

  const fields = useMemo(
    () => [
      {
        key: "customerId",
        label: "Customer",
        type: "relation" as const,
        required: true,
        defaultValue: customerId,
        readOnly: lockedCustomer,
        hidden: lockedCustomer,
        loadOptions: () => optionsFrom(athena.customers.list),
      },
      {
        key: "siteId",
        label: "Site",
        type: "relation" as const,
        required: true,
        defaultValue: presetSiteId,
        dependsOn: ["customerId"],
        loadOptions: async (form: Record<string, string>) => {
          const cid = form.customerId || customerId;
          if (!cid) return [];
          return optionsFrom(() => athena.sites.list(cid));
        },
      },
      { key: "projectType", label: "Project type", placeholder: "e.g. painting, waterproofing" },
      { key: "date", label: "Survey Date", type: "date" as const, defaultValue: new Date().toISOString().slice(0, 10) },
      { key: "clientRequirements", label: "Client requirements", type: "textarea" as const },
      { key: "existingConditions", label: "Existing conditions", type: "textarea" as const },
      { key: "notes", label: "Notes", type: "textarea" as const },
    ],
    [customerId, presetSiteId, lockedCustomer],
  );

  if (!ready) return <p className="text-stone-600">Loading…</p>;

  const backHref = entityBackHref({
    customerId: customerId || presetCustomerId,
    tab: "surveys",
    siteId: null,
    siteTab: "surveys",
  });

  const infoPanel =
    lockedCustomer && customer ? (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Customer</p>
        <p className="mt-1 font-medium text-stone-900">{String(customer.name || "")}</p>
        <p className="mt-1 text-stone-600">{String(customer.phone || "No phone")}</p>
      </div>
    ) : null;

  return (
    <RecordFormPage
      key={`${presetSiteId}-${customerId}`}
      title="New survey"
      subtitle="Record site conditions before measuring."
      backHref={backHref}
      backLabel="Customer surveys"
      successHref={backHref}
      infoPanel={infoPanel}
      fields={fields}
      onSubmit={(form) =>
        athena.surveys.create({
          customerId: form.customerId || customerId,
          siteId: form.siteId || presetSiteId,
          projectType: form.projectType || "",
          date: form.date || null,
          clientRequirements: form.clientRequirements || null,
          existingConditions: form.existingConditions || null,
          notes: form.notes || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <NewSurveyForm />
    </Suspense>
  );
}
