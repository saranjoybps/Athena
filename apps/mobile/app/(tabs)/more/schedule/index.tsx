import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { StatePill, rowStyles } from "@/components/attendance/AttendanceUi";
import { useCrews, useProjects, useSchedules } from "@/hooks/useApi";
import {
  STATE_TONE,
  localIso,
  rangeLabel,
  windowState,
  windowStateLabel,
  type Span,
  type WindowState,
} from "@/lib/attendance";
import { lightPalette as p } from "@/lib/theme";

const ORDER: Record<WindowState, number> = { active: 0, upcoming: 1, ended: 2, unscheduled: 3 };

type Row = { id: string; crew: string; project: string; span: Span; state: WindowState };

export default function ScheduleScreen() {
  const router = useRouter();
  const schedulesQ = useSchedules();
  const projectsQ = useProjects();
  const crewsQ = useCrews();
  const today = localIso();

  const rows = useMemo<Row[]>(() => {
    const projects = projectsQ.data?.items ?? [];
    const crews = crewsQ.data?.items ?? [];
    return (schedulesQ.data?.items ?? [])
      .map((item) => {
        const project = projects.find((x) => String(x.id) === String(item.projectId || ""));
        const crew = crews.find((c) => String(c.id) === String(item.crewId || ""));
        const start = String(item.startDate || "").slice(0, 10);
        const span = { id: String(item.id), start, end: String(item.endDate || start).slice(0, 10) };
        return {
          id: String(item.id),
          crew: String(crew?.name || "Crew"),
          project: String(project?.name || project?.number || "Project"),
          span,
          state: windowState(start ? [span] : [], today),
        };
      })
      .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.span.start.localeCompare(b.span.start));
  }, [schedulesQ.data, projectsQ.data, crewsQ.data, today]);

  return (
    <ModuleListScreen
      title="Schedule"
      subtitle="Crews on projects"
      items={rows}
      loading={schedulesQ.isLoading}
      refreshing={schedulesQ.isRefetching}
      errorMessage={schedulesQ.isError ? (schedulesQ.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => schedulesQ.refetch()}
      onRefresh={() => schedulesQ.refetch()}
      onAdd={() => router.push("/(tabs)/more/schedule/new" as never)}
      emptyTitle="No crews scheduled"
      emptySubtitle="Schedule a crew on a project with a start and expected end date."
      renderItem={(row) => (
        <Pressable
          style={rowStyles.row}
          onPress={() => router.push(`/(tabs)/more/schedule/${row.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel={`${row.crew} on ${row.project}`}
        >
          <Avatar name={row.crew} seed={row.id} variant="group" />
          <View style={rowStyles.body}>
            <Text style={rowStyles.title} numberOfLines={1}>
              {row.crew}
            </Text>
            <Text style={rowStyles.subtitle} numberOfLines={1}>
              {row.project}
            </Text>
            <View style={rowStyles.footer}>
              <StatePill label={windowStateLabel(row.span.start ? [row.span] : [], today)} tone={STATE_TONE[row.state]} />
              {row.span.start ? <Text style={rowStyles.meta}>{rangeLabel(row.span.start, row.span.end)}</Text> : null}
            </View>
          </View>
          <ChevronRight size={18} color={p.faint} strokeWidth={2.4} />
        </Pressable>
      )}
    />
  );
}
