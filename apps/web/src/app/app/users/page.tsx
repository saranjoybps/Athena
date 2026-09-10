"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { formatDate } from "@/lib/format";
import { athena } from "@/lib/athena-client";

function displayName(item: Record<string, unknown>): string {
  const name = item.name || item.displayName;
  if (name && String(name).trim()) return String(name);
  if (item.email) return String(item.email);
  return String(item.id || "User").slice(0, 12);
}

function accessLabel(item: Record<string, unknown>): string {
  if (Array.isArray(item.access) && item.access.length) return item.access.join(", ");
  if (Array.isArray(item.roles) && item.roles.length) {
    return item.roles.map((r) => String(r).replace(/_/g, " ")).join(", ");
  }
  if (item.role) return String(item.role);
  return String(item.status || "");
}

export default function Page() {
  const load = useCallback(() => athena.users.list(), []);
  return (
    <DataPage
      title="Users"
      subtitle="Full name, email, access modules — tap to edit."
      createHref="/app/users/new"
      createLabel="Invite user"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/users/${String(item.id)}`}
          title={displayName(item)}
          subtitle={`${String(item.email || "—")} · ${accessLabel(item)}`}
          meta={item.createdAt ? `Created ${formatDate(String(item.createdAt))}` : undefined}
          status={accessLabel(item)}
        />
      )}
    />
  );
}
