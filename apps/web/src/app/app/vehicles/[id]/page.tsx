"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => athena.vehicles.get(id), [id]);
  return (
    <EditableDetailPage
      title="Edit vehicle"
      backHref="/app/vehicles"
      backLabel="Vehicles"
      load={load}
      save={(form) =>
        athena.vehicles.update(id, {
          type: form.type,
          name: form.name || null,
          registration: form.registration || null,
          driver: form.driver || null,
        })
      }
      mapToForm={(d) => ({
        type: String(d.type || ""),
        name: String(d.name || ""),
        registration: String(d.registration || ""),
        driver: String(d.driver || ""),
      })}
      fields={[
        { key: "type", label: "Type" },
        { key: "name", label: "Name" },
        { key: "registration", label: "Registration" },
        { key: "driver", label: "Driver" },
      ]}
    />
  );
}
