import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useAttendance, useCreateAttendance, useCrews, useLabour, useProjects } from "@/hooks/useApi";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

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

export default function AttendanceScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useAttendance();
  const { data: projectsData } = useProjects();
  const { data: crewsData } = useCrews();
  const { data: labourData } = useLabour();
  const create = useCreateAttendance();

  const projects = projectsData?.items ?? [];
  const crews = crewsData?.items ?? [];
  const workers = labourData?.items ?? [];
  const items = data?.items ?? [];

  const [projectId, setProjectId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [workerId, setWorkerId] = useState("");

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(String(projects[0].id));
  }, [projects, projectId]);

  const selectedCrew = useMemo(
    () => crews.find((c) => String(c.id) === String(crewId)),
    [crews, crewId],
  );

  const workerOptions = useMemo(() => {
    if (!crewId) return workers;
    const allowed = new Set(labourIdsFromCrew(selectedCrew?.members));
    if (!allowed.size) return [];
    return workers.filter((w) => allowed.has(String(w.id)));
  }, [crewId, selectedCrew, workers]);

  useEffect(() => {
    if (workerId && !workerOptions.some((w) => String(w.id) === workerId)) {
      setWorkerId("");
    }
  }, [workerId, workerOptions]);

  async function mark(status: string) {
    if (!projectId) {
      Toast.show({ type: "error", text1: "Pick a project first" });
      return;
    }
    if (crewId && !workerId) {
      Toast.show({ type: "error", text1: "Pick a worker from this crew" });
      return;
    }
    try {
      await create.mutateAsync({
        projectId,
        status,
        overtimeHours: "0",
        crewId: crewId || undefined,
        workerId: workerId || undefined,
      });
      Toast.show({ type: "success", text1: `Marked ${status}` });
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <ScreenHeader title="Attendance" subtitle="Mark site presence" onBack={() => router.back()} />
        <Text style={styles.label}>Project</Text>
        <View style={styles.chips}>
          {projects.map((proj) => (
            <Pressable
              key={proj.id}
              style={[styles.chip, projectId === proj.id && styles.chipOn]}
              onPress={() => setProjectId(String(proj.id))}
            >
              <Text style={[styles.chipText, projectId === proj.id && styles.chipTextOn]} numberOfLines={1}>
                {String(proj.name || proj.number)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Crew (optional)</Text>
        <View style={styles.chips}>
          <Pressable
            style={[styles.chip, !crewId && styles.chipOn]}
            onPress={() => {
              setCrewId("");
              setWorkerId("");
            }}
          >
            <Text style={[styles.chipText, !crewId && styles.chipTextOn]}>All workers</Text>
          </Pressable>
          {crews.map((crew) => {
            const id = String(crew.id);
            const on = crewId === id;
            return (
              <Pressable
                key={id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => {
                  setCrewId(id);
                  setWorkerId("");
                }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                  {String(crew.name || id)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Worker {crewId ? "*" : "(optional)"}</Text>
        {crewId && workerOptions.length === 0 ? (
          <Text style={styles.hint}>No labour attached to this crew. Edit the crew to add workers.</Text>
        ) : (
          <View style={styles.chips}>
            {workerOptions.map((w) => {
              const id = String(w.id);
              const on = workerId === id;
              return (
                <Pressable key={id} style={[styles.chip, on && styles.chipOn]} onPress={() => setWorkerId(on ? "" : id)}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                    {String(w.name || id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.row}>
          {["present", "half_day", "absent", "overtime"].map((s) => (
            <Pressable key={s} style={styles.action} onPress={() => mark(s)} disabled={create.isPending}>
              <Text style={styles.actionText}>{s.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {isError ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        </View>
      ) : null}
      {isLoading ? <ActivityIndicator color={p.clay} /> : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: tabBarClearance }}
        ListEmptyComponent={!isLoading ? <EmptyState title="No attendance yet" /> : null}
        renderItem={({ item }) => (
          <RecordCard
            title={String(item.status)}
            subtitle={[item.crewId ? "crew" : null, item.workerId ? "worker" : null, String(item.projectId || "").slice(0, 8)]
              .filter(Boolean)
              .join(" · ")}
            meta={formatDate(item.createdAt)}
            status={String(item.status)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.surface,
    maxWidth: "100%",
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8, marginTop: 4 },
  action: { backgroundColor: p.clay, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
});
