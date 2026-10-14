import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, FolderKanban, MapPin } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { DirectionsButton } from "@/components/ui/DirectionsButton";
import { StatePill, rowStyles } from "@/components/attendance/AttendanceUi";
import { useProjects, useSchedules, useSites } from "@/hooks/useApi";
import {
  STATE_TONE,
  localIso,
  rangeLabel,
  scheduleSpans,
  windowOf,
  windowState,
  windowStateLabel,
  type Span,
  type WindowState,
} from "@/lib/attendance";
import { lightPalette as p } from "@/lib/theme";

const ORDER: Record<WindowState, number> = { active: 0, upcoming: 1, ended: 2, unscheduled: 3 };

type Row = {
  id: string;
  name: string;
  site: string;
  place?: Record<string, unknown>;
  spans: Span[];
  state: WindowState;
  crews: number;
};

export default function AttendanceProjects() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const projectsQ = useProjects();
  const schedulesQ = useSchedules();
  const sitesQ = useSites();
  const today = localIso();

  const rows = useMemo<Row[]>(() => {
    const schedules = schedulesQ.data?.items ?? [];
    const sites = sitesQ.data?.items ?? [];
    return (projectsQ.data?.items ?? [])
      .map((proj) => {
        const id = String(proj.id);
        const spans = scheduleSpans(schedules, id);
        const crews = new Set(
          schedules.filter((s) => String(s.projectId || "") === id && s.crewId).map((s) => String(s.crewId)),
        ).size;
        const site = sites.find((s) => String(s.id) === String(proj.siteId || ""));
        return {
          id,
          name: String(proj.name || proj.number || "Project"),
          site: String(site?.name || ""),
          place: site,
          spans,
          state: windowState(spans, today),
          crews,
        };
      })
      .sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  }, [projectsQ.data, schedulesQ.data, sitesQ.data, today]);

  if (projectId) return <Redirect href={`/(tabs)/attendance/${projectId}` as never} />;

  const activeCount = rows.filter((r) => r.state === "active").length;
  const error = projectsQ.error || schedulesQ.error;

  return (
    <ModuleListScreen
      title="Attendance"
      subtitle={activeCount ? `${activeCount} project${activeCount === 1 ? "" : "s"} in progress today` : "Choose a project"}
      items={rows}
      loading={projectsQ.isLoading || schedulesQ.isLoading}
      refreshing={projectsQ.isRefetching || schedulesQ.isRefetching}
      errorMessage={error ? (error as { userMessage?: string })?.userMessage || "Couldn't load projects." : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/more" as never))}
      onRetry={() => {
        projectsQ.refetch();
        schedulesQ.refetch();
      }}
      onRefresh={() => {
        projectsQ.refetch();
        schedulesQ.refetch();
        sitesQ.refetch();
      }}
      emptyTitle="No projects yet"
      emptySubtitle="Projects start from an approved estimate. Schedule a crew on a project to mark attendance."
      renderItem={(row) => (
        <ProjectRow row={row} today={today} onPress={() => router.push(`/(tabs)/attendance/${row.id}` as never)} />
      )}
    />
  );
}

function ProjectRow({ row, today, onPress }: { row: Row; today: string; onPress: () => void }) {
  const window = windowOf(row.spans);
  return (
    <Pressable style={rowStyles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={row.name}>
      <Avatar name={row.name} seed={row.id} icon={FolderKanban} shape="rounded" />
      <View style={rowStyles.body}>
        <Text style={rowStyles.title} numberOfLines={1}>
          {row.name}
        </Text>
        {row.site ? (
          <View style={rowStyles.metaRow}>
            <MapPin size={13} color={p.muted} strokeWidth={2.2} />
            <Text style={rowStyles.subtitle} numberOfLines={1}>
              {row.site}
            </Text>
          </View>
        ) : null}
        <View style={rowStyles.footer}>
          <StatePill label={windowStateLabel(row.spans, today)} tone={STATE_TONE[row.state]} />
          {window ? (
            <Text style={rowStyles.meta} numberOfLines={1}>
              {row.crews} crew{row.crews === 1 ? "" : "s"} · {rangeLabel(window.start, window.end)}
            </Text>
          ) : null}
        </View>
      </View>
      {row.place ? <DirectionsButton place={row.place} label={row.site || row.name} /> : null}
      <ChevronRight size={18} color={p.faint} strokeWidth={2.4} />
    </Pressable>
  );
}
