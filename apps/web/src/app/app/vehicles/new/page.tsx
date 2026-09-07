"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="New vehicle"
      backHref="/app/vehicles"
      backLabel="Vehicles"
      successHref="/app/vehicles"
      fields={[
        { key: "type", label: "Type", required: true, placeholder: "tempo / bike / truck" },
        { key: "name", label: "Name" },
        { key: "registration", label: "Registration" },
        { key: "driver", label: "Driver" },
      ]}
      onSubmit={(form) =>
        athena.vehicles.create({
          type: form.type,
          name: form.name || null,
          registration: form.registration || null,
          driver: form.driver || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
