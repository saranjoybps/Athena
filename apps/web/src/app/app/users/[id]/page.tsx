"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { EditableDetailPage } from "@/components/editable-detail";
import { athena } from "@/lib/athena-client";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(async () => {
    const res = await athena.users.list();
    const found = res.items.find((u) => String(u.id) === id);
    if (!found) throw new Error("User not found");
    return found;
  }, [id]);

  return (
    <EditableDetailPage
      title="Edit user"
      backHref="/app/users"
      backLabel="Users"
      successHref="/app/users"
      load={load}
      save={(form) =>
        athena.users.update(id, {
          name: form.name || null,
          role: form.role || null,
          status: form.status || null,
        })
      }
      mapToForm={(d) => ({
        name: String(d.name || d.displayName || ""),
        role: String(d.role || (Array.isArray(d.roles) ? d.roles[0] : "") || "supervisor"),
        status: String(d.status || "active"),
      })}
      fields={[
        { key: "name", label: "Full name" },
        {
          key: "role",
          label: "Role",
          options: [
            { value: "owner", label: "Owner" },
            { value: "manager", label: "Manager" },
            { value: "supervisor", label: "Supervisor" },
            { value: "worker", label: "Worker" },
            { value: "accountant", label: "Accountant" },
          ],
        },
        {
          key: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "invited", label: "Invited" },
            { value: "disabled", label: "Disabled" },
          ],
        },
      ]}
      subtitle={(d) => `${String(d.email || "")}${d.createdAt ? ` · Created ${String(d.createdAt).slice(0, 10)}` : ""}`}
    />
  );
}
