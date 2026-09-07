"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataPage } from "@/components/data-page";
import { athena } from "@/lib/athena-client";
import { useNameMaps } from "@/lib/name-maps";

export default function Page() {
  const { projects, labour } = useNameMaps();
  const load = useCallback(() => athena.attendance.list(), []);
  return (
    <DataPage
      title="Attendance"
      subtitle="Daily labour attendance."
      createHref="/app/attendance/new"
      createLabel="Mark attendance"
      load={load}
      render={(item) => {
        const projectId = String(item.projectId || "");
        const labourId = String(item.labourId || item.workerId || "");
        const projectName = projects[projectId] || "Project";
        const workerName = labour[labourId];
        return (
          <div key={String(item.id)} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="font-medium capitalize">{String(item.status || "recorded")}</p>
            <p className="text-sm text-stone-600">
              {workerName ? `${workerName} · ` : ""}
              {projectId ? (
                <Link href={`/app/projects/${projectId}`} className="text-clay">
                  {projectName}
                </Link>
              ) : (
                projectName
              )}
              {" · OT "}
              {String(item.overtimeHours || 0)}h
            </p>
          </div>
        );
      }}
    />
  );
}
