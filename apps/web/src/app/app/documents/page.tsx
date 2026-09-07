"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { RecordLink } from "@/components/record-link";
import { athena } from "@/lib/athena-client";

export default function Page() {
  const load = useCallback(() => athena.documents.list(), []);
  return (
    <DataPage
      title="Documents"
      subtitle="Files and links — tap to edit."
      createHref="/app/documents/new"
      createLabel="Add document"
      load={load}
      render={(item) => (
        <RecordLink
          key={String(item.id)}
          href={`/app/documents/${String(item.id)}`}
          title={String(item.name || item.id)}
          subtitle={String(item.category || item.url || '')}
        />
      )}
    />
  );
}
