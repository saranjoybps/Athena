import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useAttendance, useCreateAttendance, useProjects } from "@/hooks/useApi";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function AttendanceScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useAttendance();
  const { data: projectsData } = useProjects();
  const create = useCreateAttendance();
  const projects = projectsData?.items ?? [];
  const [projectId, setProjectId] = useState("");
  const items = data?.items ?? [];

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(String(projects[0].id));
  }, [projects, projectId]);

  async function mark(status: string) {
    if (!projectId) {
      Toast.show({ type: "error", text1: "Pick a project first" });
      return;
    }
    try {
      await create.mutateAsync({ projectId, status, overtimeHours: "0" });
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
              onPress={() => setProjectId(proj.id)}
            >
              <Text style={[styles.chipText, projectId === proj.id && styles.chipTextOn]} numberOfLines={1}>
                {String(proj.name || proj.number)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {["present", "half_day", "absent", "overtime"].map((s) => (
            <Pressable key={s} style={styles.action} onPress={() => mark(s)}>
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
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={!isLoading ? <EmptyState title="No attendance yet" /> : null}
        renderItem={({ item }) => (
          <RecordCard
            title={String(item.status)}
            subtitle={String(item.projectId || "").slice(0, 8)}
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
  label: { color: p.muted, fontWeight: "600", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.surface,
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  action: { backgroundColor: p.clay, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
});
