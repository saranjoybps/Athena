"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { customerHref } from "@/lib/customer-nav";
import { athena } from "@/lib/athena-client";

function SiteDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const queryCustomerId = search.get("customerId") || "";
  const [siteName, setSiteName] = useState("Site");
  const [customerId, setCustomerId] = useState(queryCustomerId);

  useEffect(() => {
    athena.sites
      .get(id)
      .then((d) => {
        setSiteName(String(d.name || "Site"));
        setCustomerId(queryCustomerId || (d.customerId ? String(d.customerId) : ""));
      })
      .catch(() => undefined);
  }, [id, queryCustomerId]);

  const backHref = customerId ? customerHref(customerId, "sites") : "/app/customers";

  return (
    <div>
      <Link href={backHref} className="text-sm text-clay">
        ← {customerId ? "Customer sites" : "Customers"}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{siteName}</h1>
      <p className="mt-1 text-stone-600">Site details — add survey, measurement, and estimate from the customer page.</p>
      <div className="mt-6">
        <SiteDetails id={id} customerId={customerId} />
      </div>
    </div>
  );
}

export default function SiteDetailPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <SiteDetailInner />
    </Suspense>
  );
}

function SiteDetails({ id, customerId }: { id: string; customerId: string }) {
  const load = useCallback(() => athena.sites.get(id), [id]);
  return (
    <EditableDetailPage
      title="Site details"
      backHref={customerId ? customerHref(customerId, "sites") : `/app/sites/${id}`}
      backLabel={customerId ? "Customer sites" : "Site"}
      hideBack
      load={load}
      save={async (form) => {
        const current = await athena.sites.get(id);
        await athena.sites.update(id, {
          customerId: current.customerId,
          name: form.name,
          address: form.address,
          siteType: form.siteType || null,
          accessInstructions: form.accessInstructions || null,
          mapsUrl: form.mapsUrl || null,
        });
      }}
      mapToForm={(d) => ({
        name: String(d.name || ""),
        address: String(d.address || ""),
        siteType: String(d.siteType || ""),
        accessInstructions: String(d.accessInstructions || ""),
        mapsUrl: String(d.mapsUrl || ""),
      })}
      fields={[
        { key: "name", label: "Site name" },
        { key: "address", label: "Site location", multiline: true },
        { key: "siteType", label: "Site type" },
        { key: "accessInstructions", label: "Access instructions", multiline: true },
        { key: "mapsUrl", label: "Maps URL" },
      ]}
    />
  );
}
