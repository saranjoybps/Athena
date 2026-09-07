"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";

type Tab = "details" | "surveys" | "measurements";

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("details");
  const [siteName, setSiteName] = useState("Site");
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    athena.sites
      .get(id)
      .then((d) => {
        setSiteName(String(d.name || "Site"));
        setCustomerId(d.customerId ? String(d.customerId) : null);
      })
      .catch(() => undefined);
  }, [id]);

  return (
    <div>
      <Link href="/app/sites" className="text-sm text-clay">
        ← Sites
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{siteName}</h1>
      <p className="mt-1 text-stone-600">
        Location hub — details, surveys, and measurements.
        {customerId ? (
          <>
            {" · "}
            <Link href={`/app/customers/${customerId}`} className="text-clay">
              Customer CRM →
            </Link>
          </>
        ) : null}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {(
          [
            ["details", "Details"],
            ["surveys", "Surveys"],
            ["measurements", "Measurements"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === key ? "bg-clay text-white" : "bg-white text-stone-700 shadow-sm"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "details" ? <SiteDetails id={id} /> : null}
        {tab === "surveys" ? <SiteSurveys siteId={id} /> : null}
        {tab === "measurements" ? <SiteMeasurements siteId={id} /> : null}
      </div>
    </div>
  );
}

function SiteDetails({ id }: { id: string }) {
  const load = useCallback(() => athena.sites.get(id), [id]);
  return (
    <EditableDetailPage
      title="Site details"
      backHref="/app/sites"
      backLabel="Sites"
      load={load}
      save={async (form) => {
        const current = await athena.sites.get(id);
        await athena.sites.update(id, {
          customerId: current.customerId,
          name: form.name,
          address: form.address,
          pinCode: form.pinCode || null,
          siteType: form.siteType || null,
          contactName: form.contactName || null,
          phone: form.phone || null,
          accessInstructions: form.accessInstructions || null,
        });
      }}
      mapToForm={(d) => ({
        name: String(d.name || ""),
        address: String(d.address || ""),
        pinCode: String(d.pinCode || ""),
        siteType: String(d.siteType || ""),
        contactName: String(d.contactName || ""),
        phone: String(d.phone || ""),
        accessInstructions: String(d.accessInstructions || ""),
      })}
      fields={[
        { key: "name", label: "Site name" },
        { key: "address", label: "Address", multiline: true },
        { key: "pinCode", label: "PIN code" },
        { key: "siteType", label: "Site type" },
        { key: "contactName", label: "Contact name" },
        { key: "phone", label: "Phone" },
        { key: "accessInstructions", label: "Access instructions", multiline: true },
      ]}
    />
  );
}

function SiteSurveys({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    athena.surveys
      .list(siteId)
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Surveys</h2>
          <p className="text-sm text-stone-600">Site visits and scope notes for this location.</p>
        </div>
        <Link href={`/app/surveys/new?siteId=${siteId}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Add survey
        </Link>
      </div>
      {loading ? <p className="text-stone-600">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-stone-600">No surveys yet for this site.</p>
      ) : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={String(item.id)}
            href={`/app/surveys/${String(item.id)}?fromSite=${siteId}`}
            className="block rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-clay/20"
          >
            <p className="font-medium">{String(item.number || item.id)}</p>
            <p className="text-sm text-stone-600">{String(item.projectType || item.scope || "")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SiteMeasurements({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    athena.measurements
      .list(siteId)
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Measurements</h2>
          <p className="text-sm text-stone-600">Quantity takeoffs for this location.</p>
        </div>
        <Link href={`/app/measurements/new?siteId=${siteId}`} className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Add measurement
        </Link>
      </div>
      {loading ? <p className="text-stone-600">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-stone-600">No measurements yet for this site.</p>
      ) : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={String(item.id)}
            href={`/app/measurements/${String(item.id)}?fromSite=${siteId}`}
            className="block rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-clay/20"
          >
            <p className="font-medium">{String(item.formulaKind || item.id)}</p>
            <p className="text-sm text-stone-600">{String(item.notes || JSON.stringify(item.outputs || {}))}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
