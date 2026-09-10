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
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsHint, setGpsHint] = useState<string | null>(null);

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

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGpsHint("Geolocation is not available in this browser.");
      return;
    }
    setGpsHint("Getting location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsHint(`Location captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => setGpsHint("Could not get location. Allow location access and try again."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

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
    ],
    [customerId, autoName],
  );

  const infoPanel = (
    <div className="grid gap-3">
      {customerId && customer ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Customer</p>
          <p className="mt-1 font-medium text-stone-900">{String(customer.name || "")}</p>
          <p className="mt-1 text-stone-600">{String(customer.phone || "No phone")}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">GPS location</p>
        <p className="mt-1 text-sm text-stone-600">
          {lat != null && lng != null
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : "Optional — capture the job site coordinates."}
        </p>
        <button type="button" onClick={useCurrentLocation} className="mt-3 rounded-xl bg-clay px-3 py-2 text-sm text-white">
          Use current location
        </button>
        {gpsHint ? <p className="mt-2 text-stone-600">{gpsHint}</p> : null}
      </div>
    </div>
  );

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
          lat: lat ?? null,
          lng: lng ?? null,
          mapsUrl: lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : null,
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
