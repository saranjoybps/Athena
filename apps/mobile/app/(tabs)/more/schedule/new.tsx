import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateSchedule, useCrews, useProjects, useSchedules, useSites } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DateField, todayIsoDate } from "@/components/ui/DateField";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function NewSchedule() {
  const router = useRouter();
  const projectsQ = useProjects();
  const crewsQ = useCrews();
  const schedulesQ = useSchedules();
  const sitesQ = useSites();
  const create = useCreateSchedule();

  const projects = projectsQ.data?.items ?? [];
  const crews = crewsQ.data?.items ?? [];
  const schedules = schedulesQ.data?.items ?? [];
  const sites = sitesQ.data?.items ?? [];

  const scheduledProjectIds = useMemo(
    () => new Set(schedules.map((s) => String(s.projectId || "")).filter(Boolean)),
    [schedules],
  );
  const bookedCrewIds = useMemo(
    () => new Set(schedules.map((s) => String(s.crewId || "")).filter(Boolean)),
    [schedules],
  );

  const projectChoices = useMemo(() => {
    const open = projects.filter((p) => !scheduledProjectIds.has(String(p.id)));
    const list = open.length ? open : projects;
    return list.map((p) => {
      const site = sites.find((s) => String(s.id) === String(p.siteId || ""));
      return {
        id: String(p.id),
        label: `${String(site?.name || "Site")} · ${String(p.name || p.number || p.id)}`,
      };
    });
  }, [projects, sites, scheduledProjectIds]);

  const crewChoices = useMemo(() => {
    const free = crews.filter((c) => !bookedCrewIds.has(String(c.id)));
    const list = free.length ? free : crews;
    return list.map((c) => ({ id: String(c.id), label: String(c.name || c.id) }));
  }, [crews, bookedCrewIds]);

  const [projectId, setProjectId] = useState("");
  const [crewId, setCrewId] = useState("");
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [progress, setProgress] = useState("0");

  async function submit() {
    if (!projectId) {
      Toast.show({ type: "error", text1: "Pick a project site" });
      return;
    }
    if (!crewId) {
      Toast.show({ type: "error", text1: "Pick a crew" });
      return;
    }
    if (!startDate || !endDate) {
      Toast.show({ type: "error", text1: "Start and end dates required" });
      return;
    }
    if (endDate < startDate) {
      Toast.show({ type: "error", text1: "End date must be on or after start date" });
      return;
    }
    try {
      await create.mutateAsync({
        projectId,
        crewId,
        startDate,
        endDate,
        progress: Number(progress || 0),
      });
      Toast.show({ type: "success", text1: "Schedule created" });
      router.replace("/(tabs)/more/schedule" as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New schedule" subtitle="Site → crew → dates" onBack={() => router.back()} />

        <Text style={styles.label}>Project’s site *</Text>
        {projectChoices.length === 0 ? (
          <Text style={styles.hint}>No projects yet. Start a project from an approved estimate first.</Text>
        ) : (
          <View style={styles.chips}>
            {projectChoices.map((o) => (
              <Pressable
                key={o.id}
                style={[styles.chip, projectId === o.id && styles.chipOn]}
                onPress={() => setProjectId(o.id)}
              >
                <Text style={[styles.chipText, projectId === o.id && styles.chipTextOn]} numberOfLines={2}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Crew *</Text>
        {crewChoices.length === 0 ? (
          <Text style={styles.hint}>No crews yet. Create a crew under Inventory → Crews.</Text>
        ) : (
          <View style={styles.chips}>
            {crewChoices.map((o) => (
              <Pressable key={o.id} style={[styles.chip, crewId === o.id && styles.chipOn]} onPress={() => setCrewId(o.id)}>
                <Text style={[styles.chipText, crewId === o.id && styles.chipTextOn]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <DateField label="Start date *" value={startDate} onChange={setStartDate} />
        <DateField label="Expected end date *" value={endDate} onChange={setEndDate} />

        <Text style={styles.label}>Progress %</Text>
        <TextInput
          style={styles.input}
          value={progress}
          onChangeText={setProgress}
          keyboardType="number-pad"
          placeholderTextColor={p.faint}
        />

        <Pressable style={styles.btn} onPress={submit} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create schedule</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  hint: { color: p.muted, fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: p.surface,
    maxWidth: "100%",
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
