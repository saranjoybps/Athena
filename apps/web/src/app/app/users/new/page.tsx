"use client";

import { RecordFormPage } from "@/components/record-form";
import { athena } from "@/lib/athena-client";

export default function Page() {
  return (
    <RecordFormPage
      title="Invite user"
      backHref="/app/users"
      backLabel="Users"
      successHref="/app/users"
      fields={[
        { key: "name", label: "Full name", required: true },
        { key: "email", label: "Email", required: true },
        { key: "temporaryPassword", label: "Temporary password (optional)" },
        {
          key: "role",
          label: "Role",
          type: "select",
          required: true,
          defaultValue: "supervisor",
          options: [
            { value: "owner", label: "Owner" },
            { value: "manager", label: "Manager" },
            { value: "supervisor", label: "Supervisor" },
            { value: "worker", label: "Worker" },
            { value: "accountant", label: "Accountant" },
          ],
        },
      ]}
      onSubmit={(form) =>
        athena.users.invite({
          email: form.email,
          name: form.name,
          role: form.role,
          temporaryPassword: form.temporaryPassword || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
