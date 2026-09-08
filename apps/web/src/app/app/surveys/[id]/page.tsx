"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { entityBackHref } from "@/lib/customer-nav";
import { athena } from "@/lib/athena-client";

function SurveyDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const queryCustomerId = search.get("customerId") || "";
  const fromSite = search.get("fromSite") || "";
  const [customerId, setCustomerId] = useState(queryCustomerId);
  const [siteId, setSiteId] = useState(fromSite);

  const load = useCallback(() => athena.surveys.get(id), [id]);

  useEffect(() => {
    if (queryCustomerId && fromSite) return;
    athena.surveys
      .get(id)
      .then((d) => {
        if (!queryCustomerId && d.customerId) setCustomerId(String(d.customerId));
        if (!fromSite && d.siteId) setSiteId(String(d.siteId));
      })
      .catch(() => undefined);
  }, [id, queryCustomerId, fromSite]);

  const backHref = entityBackHref({
    customerId: customerId || queryCustomerId,
    tab: "surveys",
    siteId: fromSite || siteId || null,
    siteTab: "surveys",
    fallback: "/app/customers",
  });

  return (
    <EditableDetailPage
      title="Edit survey"
      backHref={backHref}
      backLabel={fromSite || siteId ? "Site surveys" : "Back"}
      successHref={backHref}
      load={load}
      save={async (form) => {
        const current = await athena.surveys.get(id);
        await athena.surveys.update(id, {
          customerId: current.customerId,
          siteId: current.siteId,
          projectType: form.projectType || "",
          date: form.date || null,
          scope: form.scope || null,
          clientRequirements: form.clientRequirements || null,
          existingConditions: form.existingConditions || null,
          exclusions: form.exclusions || null,
          assumptions: form.assumptions || null,
          notes: form.notes || null,
        });
      }}
      mapToForm={(d) => ({
        projectType: String(d.projectType || ""),
        date: String(d.date || "").slice(0, 10),
        scope: String(d.scope || ""),
        clientRequirements: String(d.clientRequirements || ""),
        existingConditions: String(d.existingConditions || ""),
        exclusions: String(d.exclusions || ""),
        assumptions: String(d.assumptions || ""),
        notes: String(d.notes || ""),
      })}
      fields={[
        { key: "projectType", label: "Project type" },
        { key: "date", label: "Date", type: "date" },
        { key: "scope", label: "Scope", multiline: true },
        { key: "clientRequirements", label: "Client requirements", multiline: true },
        { key: "existingConditions", label: "Existing conditions", multiline: true },
        { key: "exclusions", label: "Exclusions", multiline: true },
        { key: "assumptions", label: "Assumptions", multiline: true },
        { key: "notes", label: "Notes", multiline: true },
      ]}
      subtitle={(d) => String(d.number || "")}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <SurveyDetailInner />
    </Suspense>
  );
}
