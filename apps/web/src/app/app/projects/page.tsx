"use client";

import { useCallback } from "react";
import { DataPage } from "@/components/data-page";
import { fabrica } from "@/lib/fabrica-client";

export default function ProjectsPage() {
  const load = useCallback(() => fabrica.projects.list(), []);
  return (
    <DataPage
      title="Projects"
      subtitle="Primary operational entity from approved quotes."
      load={load}
      render={(item) => (
        <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-medium">{String(item.name)}</p>
          <p className="text-sm text-stone-600">
            {String(item.number)} · {String(item.status)}
          </p>
        </div>
      )}
    />
  );
}
