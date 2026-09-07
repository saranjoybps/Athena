"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.vehicles.list(), []);
  return (
    <DataPage
      title="Vehicles"
      subtitle="Fleet — tap to edit."
      createHref="/app/vehicles/new"
      createLabel="Add vehicle"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/vehicles/${String(item.id)}`}
          title={String(item.name || item.type || item.id)}
          subtitle={String(item.registration || item.driver || '')}
        />
      )}
    />
  );
}
