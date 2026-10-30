import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField, fieldStyles } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { DateField } from "@/components/ui/DateField";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { memberIdsFromCrew } from "@/components/people/CrewFormScreen";
import { useCrews, useProjects, useSchedules, useSites } from "@/hooks/useApi";
import { localIso, rangeLabel } from "@/lib/attendance";

function daysInRange(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return [];
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end && out.length < 31) {
    out.push(cursor);
    const [y, m, d] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d));
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export type ScheduleValues = { projectId: string; crewId: string; startDate: string; endDate: string; workingDates?: string[] };
type Errors = Partial<Record<keyof ScheduleValues, string>>;

type Props = {
  mode: "create" | "edit";
  scheduleId?: string;
  initial?: ScheduleValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onSubmit: (values: ScheduleValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function ScheduleFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "Schedule a crew" : "Edit schedule"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <ScheduleFields key={initial ? props.scheduleId ?? "new" : "new"} {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function ScheduleFields({ mode, scheduleId, initial, saving, deleting, onSubmit, onDelete }: Props) {
  const projectsQ = useProjects();
  const crewsQ = useCrews();
  const schedulesQ = useSchedules();
  const sitesQ = useSites();
  const today = localIso();
  const [values, setValues] = useState<ScheduleValues>(
    initial ?? { projectId: "", crewId: "", startDate: today, endDate: today },
  );
  const [submitted, setSubmitted] = useState(false);
  const busy = saving || Boolean(deleting);

  const projects = projectsQ.data?.items ?? [];
  const crews = crewsQ.data?.items ?? [];

  const projectOptions = useMemo(() => {
    const sites = sitesQ.data?.items ?? [];
    return projects
      .filter((proj) => proj.status !== "completed" || String(proj.id) === values.projectId)
      .map((proj) => {
        const site = sites.find((s) => String(s.id) === String(proj.siteId || ""));
        return {
          id: String(proj.id),
          label: String(proj.name || proj.number || "Project"),
          detail: site?.name ? String(site.name) : undefined,
        };
      });
  }, [projects, sitesQ.data, values.projectId]);

  /**
   * Crews already tied up: scheduled on another open project that is still running or upcoming,
   * or overlapping the chosen dates (including on this project).
   */
  const clashes = useMemo(() => {
    const map = new Map<string, { projectId: string; start: string; end: string }>();
    const openProject = (id: string) => projects.find((x) => String(x.id) === id)?.status !== "completed";
    for (const s of schedulesQ.data?.items ?? []) {
      if (scheduleId && String(s.id) === scheduleId) continue;
      const cid = String(s.crewId || "");
      const pid = String(s.projectId || "");
      const start = String(s.startDate || "").slice(0, 10);
      const end = String(s.endDate || s.startDate || "").slice(0, 10);
      if (!cid || !start || !end) continue;
      const overlaps = Boolean(values.startDate && values.endDate && start <= values.endDate && values.startDate <= end);
      const elsewhere = pid !== values.projectId && openProject(pid) && end >= today;
      if (overlaps || elsewhere) map.set(cid, { projectId: pid, start, end });
    }
    return map;
  }, [schedulesQ.data, values.startDate, values.endDate, values.projectId, scheduleId, projects, today]);

  /** Workers in a busy crew; another crew sharing them would double-book those workers. */
  const busyWorkers = useMemo(() => {
    const ids = new Set<string>();
    for (const c of crews) if (clashes.has(String(c.id))) memberIdsFromCrew(c.members).forEach((w) => ids.add(w));
    return ids;
  }, [crews, clashes]);

  const projectName = (id: string) => {
    const proj = projects.find((x) => String(x.id) === id);
    return String(proj?.name || proj?.number || "another project");
  };

  const { crewOptions, hiddenCrews } = useMemo(() => {
    let hidden = 0;
    const options = crews.flatMap((c) => {
      const cid = String(c.id);
      const members = memberIdsFromCrew(c.members);
      const busy = clashes.has(cid) || members.some((w) => busyWorkers.has(w));
      if (busy && cid !== initial?.crewId) {
        hidden += 1;
        return [];
      }
      return [{ id: cid, label: String(c.name || "Crew"), detail: `${members.length} worker${members.length === 1 ? "" : "s"}` }];
    });
    return { crewOptions: options, hiddenCrews: hidden };
  }, [crews, clashes, busyWorkers, initial?.crewId]);

  function validate(v: ScheduleValues): Errors {
    const errors: Errors = {};
    if (!v.projectId) errors.projectId = "Pick a project";
    if (!v.crewId) errors.crewId = "Pick a crew";
    else {
      const c = clashes.get(v.crewId);
      if (c && v.startDate && v.endDate && c.start <= v.endDate && v.startDate <= c.end) {
        errors.crewId = `This crew is already on ${projectName(c.projectId)} from ${rangeLabel(c.start, c.end)}`;
      }
    }
    if (!v.startDate) errors.startDate = "Pick a start date";
    if (!v.endDate) errors.endDate = "Pick the expected end date";
    else if (v.startDate && v.endDate < v.startDate) errors.endDate = "The end date must be on or after the start date";
    return errors;
  }

  const errors = submitted ? validate(values) : {};

  function set<K extends keyof ScheduleValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const spanDays = daysInRange(values.startDate, values.endDate);
  const selectedDays = (values.workingDates && values.workingDates.length ? values.workingDates : spanDays).filter((d) => spanDays.includes(d));

  function toggleDay(day: string) {
    const current = new Set(selectedDays);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    const next = spanDays.filter((d) => current.has(d));
    setValues((prev) => ({ ...prev, workingDates: next.length === spanDays.length ? undefined : next }));
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    const workingDates = selectedDays.length && selectedDays.length < spanDays.length ? selectedDays : undefined;
    await onSubmit({ ...values, workingDates });
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert("Delete crew schedule?", "This schedule entry will be deleted — the crew will no longer be scheduled on the project for these dates.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete schedule", style: "destructive", onPress: () => void onDelete() },
    ]);
  }

  return (
    <View>
      <View style={styles.card}>
        <FormField label="Project" required error={errors.projectId}>
          {mode === "edit" ? (
            <View style={[fieldStyles.input, styles.locked]}>
              <Text style={styles.lockedText} numberOfLines={1}>
                {projectName(values.projectId)}
              </Text>
            </View>
          ) : (
            <SelectDropdown
              options={projectOptions}
              value={values.projectId}
              onChange={(v) => set("projectId", v)}
              placeholder={projectsQ.isLoading ? "Loading projects…" : "Select a project"}
              error={errors.projectId}
              searchPlaceholder="Search projects"
              emptyText="No open projects. Projects start from an approved estimate."
            />
          )}
        </FormField>
        <FormField label="Start date" required error={errors.startDate}>
          <DateField value={values.startDate} onChange={(v) => set("startDate", v)} error={Boolean(errors.startDate)} />
        </FormField>
        <FormField label="Expected end date" required error={errors.endDate}>
          <DateField value={values.endDate} onChange={(v) => set("endDate", v)} error={Boolean(errors.endDate)} />
        </FormField>
        {spanDays.length > 1 ? (
          <FormField label="Working days" hint="Every day in the range starts on. Turn off any day this crew will not work. Only the days you leave on can be marked, and they are paid only after attendance is marked.">
            <View style={styles.days}>
              {spanDays.map((day) => {
                const on = selectedDays.includes(day);
                const label = WEEKDAYS[new Date(`${day}T00:00:00`).getDay()];
                return (
                  <Pressable key={day} onPress={() => toggleDay(day)} style={[styles.day, on ? styles.dayOn : styles.dayOff]}>
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>{label}</Text>
                    <Text style={[styles.dayNum, on && styles.dayTextOn]}>{day.slice(8)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </FormField>
        ) : null}
        <FormField label="Crew" required error={errors.crewId}>
          <SelectDropdown
            options={crewOptions}
            value={values.crewId}
            onChange={(v) => set("crewId", v)}
            placeholder={crewsQ.isLoading ? "Loading crews…" : "Select a crew"}
            error={errors.crewId}
            searchPlaceholder="Search crews"
            emptyText={hiddenCrews ? "Every crew is busy on another project for these dates." : "No crews yet. Create a crew under People first."}
          />
          {hiddenCrews ? (
            <Text style={styles.hint}>
              {hiddenCrews} crew{hiddenCrews === 1 ? " is" : "s are"} hidden because {hiddenCrews === 1 ? "it is" : "they are"} already working on
              another project (or share workers with a crew that is).
            </Text>
          ) : null}
        </FormField>
      </View>

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{mode === "create" ? "Schedule crew" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[styles.danger, busy && styles.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={styles.dangerText}>Remove schedule</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    paddingBottom: 0,
  },
  locked: { backgroundColor: p.slateSoft },
  hint: { color: p.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  lockedText: { color: p.text, fontSize: 15 },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  day: { minWidth: 52, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  dayOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  dayOff: { backgroundColor: p.background, borderColor: p.border },
  dayText: { fontSize: 12, fontWeight: "700", color: p.muted },
  dayTextOn: { color: p.clayDark },
  dayNum: { fontSize: 12, color: p.faint },
  primary: {
    marginTop: spacing.lg,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
    ...softShadow,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  danger: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: p.redSoft,
  },
  dangerText: { color: p.red, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
