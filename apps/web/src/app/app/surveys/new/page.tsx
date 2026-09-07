"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

function NewSurveyForm() {
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
      { key: "projectType", label: "Project type", defaultValue: "painting" },
      { key: "date", label: "Date", type: "date" as const },
      { key: "scope", label: "Scope", type: "textarea" as const },
      { key: "clientRequirements", label: "Client requirements", type: "textarea" as const },
      { key: "existingConditions", label: "Existing conditions", type: "textarea" as const },
      { key: "notes", label: "Notes", type: "textarea" as const },
    ],
    [customerId, presetSiteId],
  );

  if (!ready) return <p className="text-stone-600">Loading…</p>;

  return (
    <RecordFormPage
      key={`${presetSiteId}-${customerId}`}
      title="New survey"
      subtitle={presetSiteId ? "Linked to the selected site." : "Pick a customer and site."}
      backHref={presetSiteId ? `/app/sites/${presetSiteId}` : "/app/sites"}
      backLabel={presetSiteId ? "Back to site" : "Sites"}
      successHref={presetSiteId ? `/app/sites/${presetSiteId}` : "/app/sites"}
      fields={fields}
      onSubmit={(form) =>
        athena.surveys.create({
          customerId: form.customerId || customerId,
          siteId: form.siteId || presetSiteId,
          projectType: form.projectType || "painting",
          date: form.date || null,
          scope: form.scope || null,
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
