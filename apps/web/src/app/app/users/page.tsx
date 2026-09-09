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

function roleLabel(item: Record<string, unknown>): string {
  if (item.role) return String(item.role);
  if (Array.isArray(item.roles) && item.roles.length) return String(item.roles[0]);
  return String(item.status || "");
}

export default function Page() {
  const load = useCallback(() => athena.users.list(), []);
  return (
    <DataPage
      title="Users"
      subtitle="Full name, email, role, created on — tap to edit."
      createHref="/app/users/new"
      createLabel="Invite user"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/users/${String(item.id)}`}
          title={displayName(item)}
          subtitle={`${String(item.email || "—")} · ${roleLabel(item)}`}
          meta={item.createdAt ? `Created ${formatDate(String(item.createdAt))}` : undefined}
          status={roleLabel(item)}
        />
      )}
    />
  );
}
