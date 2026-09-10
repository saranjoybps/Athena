import { useMemo } from "react";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useCrews, useProjects, useSchedules, useSites } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

export default function ScheduleScreen() {
  const router = useRouter();
  const schedulesQ = useSchedules();
  const projectsQ = useProjects();
  const crewsQ = useCrews();
  const sitesQ = useSites();

  const items = schedulesQ.data?.items ?? [];
  const projects = projectsQ.data?.items ?? [];
  const crews = crewsQ.data?.items ?? [];
  const sites = sitesQ.data?.items ?? [];

  const enriched = useMemo(() => {
    return items.map((item) => {
      const project = projects.find((p) => String(p.id) === String(item.projectId || ""));
      const site = sites.find((s) => String(s.id) === String(project?.siteId || ""));
      const crew = crews.find((c) => String(c.id) === String(item.crewId || ""));
      const title = site?.name
        ? `${String(site.name)} · ${String(project?.name || project?.number || "Project")}`
        : String(project?.name || project?.number || `Project ${String(item.projectId || "").slice(0, 8)}`);
      return {
        ...item,
        _title: title,
        _subtitle: `${formatDate(String(item.startDate || ""))} → ${formatDate(String(item.endDate || ""))} · ${
          String(item.dayType || "full_day") === "half_day" ? "Half day" : "Full day"
        }${crew ? ` · ${String(crew.name)}` : item.crewId ? ` · crew` : ""}${
          item.progress != null ? ` · ${String(item.progress)}%` : ""
        }`,
      };
    });
  }, [items, projects, crews, sites]);

  return (
    <ModuleListScreen
      title="Schedule"
      subtitle="Crew and project calendar"
      items={enriched}
      loading={schedulesQ.isLoading}
      refreshing={schedulesQ.isRefetching}
      errorMessage={
        schedulesQ.isError ? (schedulesQ.error as { userMessage?: string })?.userMessage : undefined
      }
      onBack={() => router.back()}
      onRetry={() => schedulesQ.refetch()}
      onRefresh={() => schedulesQ.refetch()}
      onAdd={() => router.push("/(tabs)/more/schedule/new" as never)}
      emptyTitle="No schedule entries"
      emptySubtitle="Assign a crew to a project site with start and expected end dates."
      renderItem={(item) => (
        <RecordCard title={String(item._title || "Schedule")} subtitle={String(item._subtitle || "")} />
      )}
    />
  );
}
