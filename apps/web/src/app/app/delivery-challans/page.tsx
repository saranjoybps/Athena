"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.deliveryChallans.list(), []);
  return (
    <DataPage
      title="Delivery challans"
      subtitle="Outbound delivery notes with vehicle and receiver details."
      createHref="/app/delivery-challans/new"
      createLabel="New challan"
      load={load}
      render={(item) => {
        const customer = (item.customer as { name?: string } | undefined)?.name;
        return (
          <RecordLink
            key={String(item.id)}
            href={`/app/delivery-challans/${String(item.id)}`}
            title={String(item.number || item.id)}
            subtitle={[
              customer,
              item.vehicleNumber ? `Vehicle ${String(item.vehicleNumber)}` : null,
              item.date ? formatDate(String(item.date)) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            status={item.status ? String(item.status) : undefined}
          />
        );
      }}
    />
  );
}
