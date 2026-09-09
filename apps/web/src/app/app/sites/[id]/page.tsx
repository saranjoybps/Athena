"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { SiteFilesPanel } from "@/components/site-files-panel";
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
      <SiteFilesPanel siteId={id} />
      <SiteSchedule siteId={id} />
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

function SiteSchedule({ siteId }: { siteId: string }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    Promise.all([athena.projects.list(), athena.schedules.list()])
      .then(([projects, schedules]) => {
        const projectIds = new Set(
          (projects.items || []).filter((p) => String(p.siteId || "") === siteId).map((p) => String(p.id)),
        );
        setRows((schedules.items || []).filter((s) => projectIds.has(String(s.projectId || ""))));
      })
      .catch(() => setRows([]));
  }, [siteId]);
  if (!rows.length) return null;
  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Schedule</h2>
      <div className="mt-3 grid gap-2">
        {rows.map((item) => (
          <div key={String(item.id)} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
            <p className="font-medium">Project {String(item.projectId || "")}</p>
            <p className="text-stone-600">
              {String(item.startDate || "")} → {String(item.endDate || "")}
              {item.crewId ? ` · crew ${String(item.crewId)}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
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
