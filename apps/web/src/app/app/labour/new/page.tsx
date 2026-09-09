"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New worker"
      backHref="/app/labour"
      backLabel="Labour"
      successHref="/app/labour"
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone" },
        { key: "trade", label: "Trade", placeholder: "painter / mason / electrician" },
        { key: "dailyRate", label: "Daily rate", required: true },
      ]}
      onSubmit={(form) =>
        athena.labour.create({
          name: form.name,
          phone: form.phone || null,
          trade: form.trade || null,
          dailyRate: form.dailyRate || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
