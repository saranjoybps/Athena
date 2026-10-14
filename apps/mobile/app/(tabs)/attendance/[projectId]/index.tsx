import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { StatePill, rowStyles } from "@/components/attendance/AttendanceUi";
import { memberIdsFromCrew } from "@/components/people/CrewFormScreen";
import { useCrews, useProject, useProjectAttendance, useProjectSchedules } from "@/hooks/useApi";
import {
  STATE_TONE,
  localIso,
  markDay,
  rangeLabel,
  scheduleSpans,
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
  spans: Span[];
  state: WindowState;
  members: number;
  markedToday: number;
};

export default function AttendanceProjectCrews() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const pid = String(projectId || "");
  const projectQ = useProject(pid);
  const schedulesQ = useProjectSchedules(pid);
  const crewsQ = useCrews();
  const attendanceQ = useProjectAttendance(pid);
  const today = localIso();

  const rows = useMemo<Row[]>(() => {
    const schedules = schedulesQ.data?.items ?? [];
    const crews = crewsQ.data?.items ?? [];
    const marks = attendanceQ.data?.items ?? [];
    const crewIds = [...new Set(schedules.map((s) => String(s.crewId || "")).filter(Boolean))];
    return crewIds
      .map((cid) => {
        const crew = crews.find((c) => String(c.id) === cid);
        const spans = scheduleSpans(schedules, pid, cid);
        const markedToday = new Set(
          marks.filter((m) => String(m.crewId || "") === cid && markDay(m) === today).map((m) => String(m.workerId)),
        ).size;
        return {
          id: cid,
          name: String(crew?.name || "Crew"),
          spans,
          state: windowState(spans, today),
          members: memberIdsFromCrew(crew?.members).length,
          markedToday,
        };
      })
      .sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  }, [schedulesQ.data, crewsQ.data, attendanceQ.data, pid, today]);

  const projectName = String(projectQ.data?.name || projectQ.data?.number || "Project");
  const error = schedulesQ.error || crewsQ.error;

  return (
    <ModuleListScreen
      title={projectName}
      subtitle="Scheduled crews"
      items={rows}
      loading={schedulesQ.isLoading || crewsQ.isLoading}
      refreshing={schedulesQ.isRefetching || attendanceQ.isRefetching}
      errorMessage={error ? (error as { userMessage?: string })?.userMessage || "Couldn't load crews." : undefined}
      onBack={() => router.back()}
      onRetry={() => {
        schedulesQ.refetch();
        crewsQ.refetch();
      }}
      onRefresh={() => {
        schedulesQ.refetch();
        crewsQ.refetch();
        attendanceQ.refetch();
      }}
      emptyTitle="No crew scheduled"
      emptySubtitle="Schedule a crew on this project with a start and expected end date to mark its attendance."
      emptyActionLabel="Schedule a crew"
      onEmptyAction={() => router.push(`/(tabs)/more/schedule/new?projectId=${pid}` as never)}
      renderItem={(row) => (
        <CrewRow
          row={row}
          today={today}
          onPress={() => router.push(`/(tabs)/attendance/${pid}/${row.id}` as never)}
        />
      )}
    />
  );
}

function CrewRow({ row, today, onPress }: { row: Row; today: string; onPress: () => void }) {
  return (
    <Pressable style={rowStyles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={row.name}>
      <Avatar name={row.name} seed={row.id} variant="group" />
      <View style={rowStyles.body}>
        <Text style={rowStyles.title} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={rowStyles.subtitle} numberOfLines={1}>
          {row.members} worker{row.members === 1 ? "" : "s"}
          {row.spans.length ? ` · ${row.spans.map((s) => rangeLabel(s.start, s.end)).join(", ")}` : ""}
        </Text>
        <View style={rowStyles.footer}>
          <StatePill label={windowStateLabel(row.spans, today)} tone={STATE_TONE[row.state]} />
          {row.state === "active" && row.members > 0 ? (
            <Text style={rowStyles.meta}>
              {Math.min(row.markedToday, row.members)}/{row.members} marked today
            </Text>
          ) : null}
        </View>
      </View>
      <ChevronRight size={18} color={p.faint} strokeWidth={2.4} />
    </Pressable>
  );
}
