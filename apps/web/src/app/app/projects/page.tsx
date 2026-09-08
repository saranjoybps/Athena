"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function ProjectsPage() {
  const load = useCallback(() => athena.projects.list(), []);
  return (
    <DataPage
      title="Projects"
      subtitle="Projects start from an approved estimate. Open a project for invoices, expenses, and collections."
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/projects/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={`${item.number || ""} · ${item.status || ""}`}
          status={item.status ? String(item.status) : undefined}
        />
      )}
    />
  );
}
