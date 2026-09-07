"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";
import { formatDate } from "@/lib/format";
import { useNameMaps } from "@/lib/name-maps";

export default function Page() {
  const { projects, crews } = useNameMaps();
  const load = useCallback(() => athena.schedules.list(), []);
  return (
    <DataPage
      title="Schedule"
      subtitle="Crew and project calendar."
      createHref="/app/schedule/new"
      createLabel="Add schedule"
      load={load}
      render={(item) => {
        const projectId = String(item.projectId || "");
        const crewId = String(item.crewId || "");
        const title = projects[projectId] || "Scheduled work";
        return (
          <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-stone-600">
              {formatDate(String(item.startDate || ""))} → {formatDate(String(item.endDate || ""))} · {String(item.progress || 0)}%
              {crewId ? ` · ${crews[crewId] || "Crew"}` : ""}
            </p>
            {projectId ? (
              <Link href={`/app/projects/${projectId}`} className="mt-2 inline-block text-xs text-clay">
                Open project →
              </Link>
            ) : null}
          </div>
        );
      }}
    />
  );
}
