import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { Plus } from "lucide-react-native";
import { useAttendance, useCreateAttendance, useCrews, useLabour, useProjects, useSchedules } from "@/hooks/useApi";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance, softShadow } from "@/lib/theme";

function labourIdsFromCrew(members: unknown): string[] {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => {
      if (!m || typeof m !== "object") return "";
      const row = m as Record<string, unknown>;
      return String(row.labourId || row.workerId || "");
    })
    .filter(Boolean);
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildDateStrip(center = new Date(), days = 7) {
  const start = new Date(center);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - Math.floor(days / 2));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      iso: isoDay(d),
      day: d.getDate(),
      weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
      month: d.toLocaleDateString(undefined, { month: "short" }),
    };
  });
}

type Step = "projects" | "crew" | "mark";

const STATUS_ACTIONS = [
  { id: "present", label: "Present" },
  { id: "half_day", label: "Half day" },
  { id: "leave", label: "Leave" },
] as const;

export default function AttendanceScreen() {
  const router = useRouter();
  const { projectId: projectParam } = useLocalSearchParams<{ projectId?: string }>();
  const { data, isLoading, isError, error, refetch } = useAttendance();
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const { data: crewsData } = useCrews();
  const { data: labourData } = useLabour();
  const { data: schedulesData } = useSchedules();
  const create = useCreateAttendance();

  const projects = projectsData?.items ?? [];
  const crews = crewsData?.items ?? [];
  const workers = labourData?.items ?? [];
  const schedules = schedulesData?.items ?? [];
  const items = data?.items ?? [];

  const [step, setStep] = useState<Step>(projectParam ? "crew" : "projects");
  const [projectId, setProjectId] = useState(projectParam ? String(projectParam) : "");
  const [crewId, setCrewId] = useState("");
  const [workDate, setWorkDate] = useState(isoDay(new Date()));
  const dateStrip = useMemo(() => buildDateStrip(new Date(), 7), []);

  const projectCrews = useMemo(() => {
    if (!projectId) return [];
    const scheduledCrewIds = new Set(
      schedules.filter((s) => String(s.projectId) === projectId).map((s) => String(s.crewId || "")).filter(Boolean),
    );
    if (scheduledCrewIds.size) {
      return crews.filter((c) => scheduledCrewIds.has(String(c.id)));
    }
    return crews;
  }, [projectId, schedules, crews]);

  const selectedCrew = useMemo(
    () => crews.find((c) => String(c.id) === String(crewId)),
    [crews, crewId],
  );

  const crewWorkers = useMemo(() => {
    const allowed = new Set(labourIdsFromCrew(selectedCrew?.members));
    if (!allowed.size) return [];
    return workers.filter((w) => allowed.has(String(w.id)));
  }, [selectedCrew, workers]);

  const selectedProject = projects.find((p) => String(p.id) === projectId);

  async function mark(workerId: string, status: string) {
    if (!projectId || !crewId) return;
    try {
      await create.mutateAsync({
        projectId,
        status,
        overtimeHours: "0",
        crewId,
        workerId,
        date: workDate,
      });
      Toast.show({ type: "success", text1: `Marked ${status.replace("_", " ")}`, text2: formatDate(workDate) });
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const filters = [
    { key: "all", label: "All" },
    { key: "present", label: "Present" },
    { key: "half_day", label: "Half day" },
    { key: "leave", label: "Leave" },
  ] as const;
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");

  const dayMarks = useMemo(() => {
    return items.filter((row) => {
      if (String(row.projectId) !== String(projectId)) return false;
      if (String(row.workDate || row.date || "").slice(0, 10) !== workDate) return false;
      if (filter !== "all" && String(row.status) !== filter) return false;
      return true;
    });
  }, [items, projectId, workDate, filter]);

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title="Attendance"
            subtitle={
              step === "projects"
                ? "Pick a project"
                : step === "crew"
                  ? "Pick a crew"
                  : String(selectedProject?.name || selectedProject?.number || "Mark labour")
            }
            onBack={() => {
              if (step === "mark") {
                setStep("crew");
                setCrewId("");
                return;
              }
              if (step === "crew") {
                setStep("projects");
                setProjectId("");
                return;
              }
              router.replace("/(tabs)/more" as never);
            }}
            right={
              <Pressable
                style={styles.addBtn}
                onPress={() => {
                  if (step === "crew" || step === "mark") {
                    router.push("/(tabs)/more/crews/new" as never);
                    return;
                  }
                  router.push("/(tabs)/projects/new" as never);
                }}
                accessibilityLabel="Add"
              >
                <Plus size={22} color="#fff" strokeWidth={2.6} />
              </Pressable>
            }
          />

          {isError ? (
            <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
          ) : null}
          {projectsLoading || isLoading ? <ActivityIndicator color={p.clay} style={{ marginBottom: 12 }} /> : null}

          {step === "projects" ? (
            <>
              {projects.length === 0 ? <EmptyState title="No projects yet" /> : null}
              {projects.map((proj) => (
                <Pressable
                  key={String(proj.id)}
                  style={styles.card}
                  onPress={() => {
                    setProjectId(String(proj.id));
                    setCrewId("");
                    setStep("crew");
                  }}
                >
                  <Text style={styles.cardTitle}>{String(proj.name || proj.number || proj.id)}</Text>
                  <Text style={styles.cardSub}>{String(proj.status || "active")}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {step === "crew" ? (
            <>
              {projectCrews.length === 0 ? (
                <EmptyState title="No crews for this project" subtitle="Add a schedule inside the project, or create crews first." />
              ) : null}
              {projectCrews.map((crew) => (
                <Pressable
                  key={String(crew.id)}
                  style={styles.card}
                  onPress={() => {
                    setCrewId(String(crew.id));
                    setStep("mark");
                  }}
                >
                  <Text style={styles.cardTitle}>{String(crew.name || crew.id)}</Text>
                  <Text style={styles.cardSub}>{labourIdsFromCrew(crew.members).length} workers</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {step === "mark" ? (
            <>
              <Text style={styles.section}>Work date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                {dateStrip.map((d) => {
                  const on = d.iso === workDate;
                  return (
                    <Pressable key={d.iso} style={[styles.dateChip, on && styles.dateChipOn]} onPress={() => setWorkDate(d.iso)}>
                      <Text style={[styles.dateMonth, on && styles.dateOnText]}>{d.month}</Text>
                      <Text style={[styles.dateDay, on && styles.dateOnText]}>{d.day}</Text>
                      <Text style={[styles.dateWeek, on && styles.dateOnText]}>{d.weekday}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.hint}>You can mark previous days in this strip.</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {filters.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable key={f.key} style={[styles.filterChip, on && styles.filterChipOn]} onPress={() => setFilter(f.key)}>
                      <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {crewWorkers.length === 0 ? (
                <EmptyState title="No labour on this crew" subtitle="Edit the crew and attach workers." />
              ) : null}
              {crewWorkers.map((w) => {
                const wid = String(w.id);
                const already = dayMarks.find((m) => String(m.workerId) === wid);
                return (
                  <View key={wid} style={styles.workerCard}>
                    <View style={styles.workerHead}>
                      <View>
                        <Text style={styles.cardTitle}>{String(w.name || wid)}</Text>
                        <Text style={styles.cardSub}>Day rate {String(w.dailyRate || "0")}</Text>
                      </View>
                      {already ? (
                        <Text style={styles.statusPill}>{String(already.status).replace("_", " ")}</Text>
                      ) : (
                        <Text style={styles.todoPill}>To do</Text>
                      )}
                    </View>
                    <View style={styles.row}>
                      {STATUS_ACTIONS.map((s) => (
                        <Pressable
                          key={s.id}
                          style={[styles.action, already && String(already.status) === s.id && styles.actionOn]}
                          onPress={() => mark(wid, s.id)}
                          disabled={create.isPending}
                        >
                          <Text style={[styles.actionText, already && String(already.status) === s.id && styles.actionTextOn]}>
                            {s.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 12 },
  dateRow: { gap: 8, paddingBottom: 4 },
  dateChip: {
    width: 64,
    borderRadius: radius.lg,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 10,
    alignItems: "center",
  },
  dateChipOn: { backgroundColor: p.clay, borderColor: p.clay },
  dateMonth: { color: p.muted, fontSize: 11, fontWeight: "600" },
  dateDay: { color: p.text, fontSize: 20, fontWeight: "800", marginVertical: 2 },
  dateWeek: { color: p.muted, fontSize: 11, fontWeight: "600" },
  dateOnText: { color: "#fff" },
  filterRow: { gap: 8, marginBottom: 12 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: p.peach,
  },
  filterChipOn: { backgroundColor: p.clay },
  filterText: { color: p.clayDark, fontWeight: "700", fontSize: 13 },
  filterTextOn: { color: "#fff" },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 10,
  },
  workerCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 10,
  },
  workerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  cardTitle: { color: p.text, fontWeight: "700", fontSize: 16 },
  cardSub: { color: p.muted, marginTop: 4, fontSize: 13 },
  statusPill: {
    backgroundColor: p.claySoft,
    color: p.clayDark,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  todoPill: {
    backgroundColor: p.sky,
    color: p.blue,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  action: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.background,
  },
  actionOn: { backgroundColor: p.clay, borderColor: p.clay },
  actionText: { color: p.muted, fontWeight: "700", fontSize: 12 },
  actionTextOn: { color: "#fff" },
});
