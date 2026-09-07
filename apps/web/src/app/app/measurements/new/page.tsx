"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

function NewMeasurementForm() {
  const search = useSearchParams();
  const presetSiteId = search.get("siteId") || "";
  const [customerId, setCustomerId] = useState("");
  const [ready, setReady] = useState(!presetSiteId);

  useEffect(() => {
    if (!presetSiteId) return;
    athena.sites
      .get(presetSiteId)
      .then((s) => {
        setCustomerId(String(s.customerId || ""));
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [presetSiteId]);

  const fields = useMemo(
    () => [
      {
        key: "customerId",
        label: "Customer",
        type: "relation" as const,
        required: true,
        defaultValue: customerId,
        loadOptions: () => optionsFrom(athena.customers.list),
      },
      {
        key: "siteId",
        label: "Site",
        type: "relation" as const,
        required: true,
        defaultValue: presetSiteId,
        loadOptions: () => optionsFrom(athena.sites.list),
      },
      {
        key: "surveyId",
        label: "Survey (optional)",
        type: "relation" as const,
        loadOptions: () => optionsFrom(() => athena.surveys.list(presetSiteId || undefined), ["number", "id"]),
      },
      { key: "formulaKind", label: "Formula kind", defaultValue: "painting" },
      { key: "wallArea", label: "Wall area (sqft)", type: "number" as const, required: true },
      { key: "ceilingArea", label: "Ceiling area (sqft)", type: "number" as const, defaultValue: "0" },
      { key: "notes", label: "Notes", type: "textarea" as const },
    ],
    [customerId, presetSiteId],
  );

  if (!ready) return <p className="text-stone-600">Loading…</p>;

  return (
    <RecordFormPage
      key={`${presetSiteId}-${customerId}`}
      title="New measurement"
      subtitle={presetSiteId ? "Linked to the selected site." : "Pick a customer and site."}
      backHref={presetSiteId ? `/app/sites/${presetSiteId}` : "/app/sites"}
      backLabel={presetSiteId ? "Back to site" : "Sites"}
      successHref={presetSiteId ? `/app/sites/${presetSiteId}` : "/app/sites"}
      fields={fields}
      onSubmit={(form) =>
        athena.measurements.create({
          customerId: form.customerId || customerId,
          siteId: form.siteId || presetSiteId,
          surveyId: form.surveyId || null,
          formulaKind: form.formulaKind || "painting",
          originalUnit: "sqft",
          inputs: {
            wallArea: Number(form.wallArea || 0),
            ceilingArea: Number(form.ceilingArea || 0),
          },
          notes: form.notes || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <NewMeasurementForm />
    </Suspense>
  );
}
