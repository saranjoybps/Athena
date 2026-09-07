"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";

function displayUser(item: Record<string, unknown>): string {
  const name = item.name || item.displayName;
  if (name && String(name).trim()) return String(name);
  if (item.email) return String(item.email);
  const userId = item.userId ? String(item.userId) : "";
  if (userId === "local-owner") return "Demo Owner";
  if (userId) return userId;
  // Membership docs sometimes use composite ids like local-owner_<orgId>
  const id = String(item.id || "");
  if (id.startsWith("local-owner")) return "Demo Owner";
  return id.slice(0, 12) || "User";
}

export default function Page() {
  const load = useCallback(() => athena.users.list(), []);
  return (
    <DataPage
      title="Users"
      subtitle="Team members."
      createHref="/app/users/new"
      createLabel="Invite user"
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">{displayUser(item)}</p>
          <p className="text-sm text-stone-600 capitalize">
            {String(item.role || (Array.isArray(item.roles) ? item.roles.join(", ") : "") || item.status || "")}
          </p>
        </div>
      )}
    />
  );
}
