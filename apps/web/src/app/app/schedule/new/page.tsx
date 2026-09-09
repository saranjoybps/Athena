"use client";

import { useEffect, useMemo, useState } from "react";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [schedules, setSchedules] = useState<Record<string, unknown>[]>([]);
  const [sites, setSites] = useState<Record<string, unknown>[]>([]);
  const [crews, setCrews] = useState<Array<{ value: string; label: string }>>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    Promise.all([athena.projects.list(), athena.schedules.list(), athena.sites.list(), optionsFrom(athena.crews.list)])
      .then(([p, s, sitesRes, crewOpts]) => {
        setProjects(p.items || []);
        setSchedules(s.items || []);
        setSites(sitesRes.items || []);
        setCrews(crewOpts);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load schedule options"))
      .finally(() => setReady(true));
  }, []);

  const scheduledProjectIds = useMemo(
    () => new Set(schedules.map((s) => String(s.projectId || "")).filter(Boolean)),
    [schedules],
  );

  const allProjectOptions = useMemo(() => {
    return projects.map((p) => {
      const id = String(p.id);
      const site = sites.find((s) => String(s.id) === String(p.siteId || ""));
      const hasSchedule = scheduledProjectIds.has(id);
      const label = `${String(site?.name || "Site")} · ${String(p.name || p.number || id)}${
        hasSchedule ? " (already scheduled)" : ""
      }`;
      return { value: id, label, hasSchedule };
    });
  }, [projects, sites, scheduledProjectIds]);

  // Prefer projects without a schedule; if none left, still show all so the dropdown is not empty.
  const projectOptions = useMemo(() => {
    const open = allProjectOptions.filter((o) => !o.hasSchedule).map(({ value, label }) => ({ value, label }));
    if (open.length) return open;
    return allProjectOptions.map(({ value, label }) => ({ value, label }));
  }, [allProjectOptions]);

  // Prefer crews not already on a schedule; fall back to full crew list.
  const crewOptions = useMemo(() => {
    const booked = new Set(schedules.map((s) => String(s.crewId || "")).filter(Boolean));
    const free = crews.filter((c) => !booked.has(c.value));
    return free.length ? free : crews;
  }, [crews, schedules]);

  if (!ready) {
    return <p className="text-stone-600">Loading schedule options…</p>;
  }

  if (loadError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">New schedule entry</h1>
        <p className="mt-2 text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  return (
    <RecordFormPage
      title="New schedule entry"
      subtitle="Project’s site → crew → start → expected end → progress."
      backHref="/app/schedule"
      backLabel="Schedule"
      successHref="/app/schedule"
      infoBanner={
        <>
          {hint ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{hint}</p> : null}
          {!projects.length ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No projects yet — create a project from an approved estimate first.
            </p>
          ) : null}
          {!crews.length ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No crews yet — create a crew under Inventory → Crews first.
            </p>
          ) : null}
        </>
      }
      fields={[
        {
          key: "projectId",
          label: "Project’s site",
          type: "select",
          required: true,
          options: projectOptions,
        },
        {
          key: "crewId",
          label: "Crew",
          type: "select",
          required: true,
          options: crewOptions,
        },
        { key: "startDate", label: "Start date", type: "date", required: true },
        { key: "endDate", label: "Expected end date", type: "date", required: true },
        { key: "progress", label: "Progress %", type: "number", defaultValue: "0" },
      ]}
      onSubmit={async (form) => {
        setHint("");
        try {
          return (await athena.schedules.create({
            projectId: form.projectId,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            crewId: form.crewId || null,
            progress: Number(form.progress || 0),
          })) as { id?: string };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed";
          setHint(msg);
          throw e;
        }
      }}
    />
  );
}
