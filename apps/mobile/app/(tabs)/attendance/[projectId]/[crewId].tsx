import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { CalendarClock, CalendarDays, CheckCheck, PencilLine } from "lucide-react-native";
import {
  useClearAttendance,
  useCreateAttendance,
  useCrews,
  useLabour,
  useProject,
  useProjectAttendance,
  useProjectSchedules,
  useUpdateAttendance,
} from "@/hooks/useApi";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { StatePill } from "@/components/attendance/AttendanceUi";
import { memberIdsFromCrew } from "@/components/people/CrewFormScreen";
import {
  ATTENDANCE_STATUSES,
  dayLabel,
  localIso,
  markDay,
  markableDays,
  parseDay,
  rangeLabel,
  scheduleSpans,
  statusMeta,
  type AttendanceStatus,
} from "@/lib/attendance";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

const CHIP = 60;
const CHIP_GAP = 8;

type Worker = { id: string; name: string; trade: string };

function errorText(e: unknown) {
  return (e as { userMessage?: string })?.userMessage || "Please try again.";
}

function errorCode(e: unknown) {
  return (e as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

function stamp(row: AthenaRecord) {
  return String(row.updatedAt || row.createdAt || "");
}

function workHint(line: AthenaRecord) {
  const method = String(line.billingMethod || "");
  const unit = String(line.unit || "");
  if (method === "fixed" || unit === "job") return "Share of this job finished today, from 0 to 1";
  if (method === "area") return `Area finished today${unit ? ` (${unit})` : ""}`;
  if (method === "length") return `Length finished today${unit ? ` (${unit})` : ""}`;
  if (method === "quantity") return `Number finished today${unit ? ` (${unit})` : ""}`;
  if (method === "time") return `Time finished today${unit ? ` (${unit})` : ""}`;
  return `Finished today${unit ? ` (${unit})` : ""}`;
}

export default function MarkAttendance() {
  const router = useRouter();
  const { projectId, crewId } = useLocalSearchParams<{ projectId: string; crewId: string }>();
  const pid = String(projectId || "");
  const cid = String(crewId || "");
  const projectQ = useProject(pid);
  const crewsQ = useCrews();
  const labourQ = useLabour();
  const schedulesQ = useProjectSchedules(pid);
  const attendanceQ = useProjectAttendance(pid);
  const create = useCreateAttendance();
  const update = useUpdateAttendance();
  const clear = useClearAttendance();
  const today = localIso();

  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [workQty, setWorkQty] = useState<Record<string, Record<string, string>>>({});

  const crew = useMemo(() => (crewsQ.data?.items ?? []).find((c) => String(c.id) === cid), [crewsQ.data, cid]);
  const spans = useMemo(() => scheduleSpans(schedulesQ.data?.items ?? [], pid, cid), [schedulesQ.data, pid, cid]);
  const days = useMemo(() => markableDays(spans, today), [spans, today]);
  const workDate = picked && days.includes(picked) ? picked : days[days.length - 1] ?? null;

  /** Latest mark per day and worker for this project (the API keeps one per project/worker/day). */
  const marksByDay = useMemo(() => {
    const map = new Map<string, Map<string, AthenaRecord>>();
    for (const row of attendanceQ.data?.items ?? []) {
      const day = markDay(row);
      const wid = String(row.workerId || "");
      if (!day || !wid) continue;
      let byWorker = map.get(day);
      if (!byWorker) {
        byWorker = new Map();
        map.set(day, byWorker);
      }
      const prev = byWorker.get(wid);
      if (!prev || stamp(row) >= stamp(prev)) byWorker.set(wid, row);
    }
    return map;
  }, [attendanceQ.data]);

  const memberIds = useMemo(() => memberIdsFromCrew(crew?.members), [crew]);

  const workers = useMemo<Worker[]>(() => {
    const ids = [...memberIds];
    const dayMarks = workDate ? marksByDay.get(workDate) : undefined;
    dayMarks?.forEach((row, wid) => {
      if (String(row.crewId || "") === cid && !ids.includes(wid)) ids.push(wid);
    });
    const labour = labourQ.data?.items ?? [];
    const snapshot = Array.isArray(crew?.members) ? (crew?.members as Record<string, unknown>[]) : [];
    return ids.map((id) => {
      const w = labour.find((l) => String(l.id) === id);
      const snap = snapshot.find((m) => String(m?.labourId || m?.workerId || "") === id);
      const trade = String(w?.trade || w?.skill || "").trim();
      return {
        id,
        name: String(w?.name || snap?.name || "Worker"),
        trade: trade ? trade.charAt(0).toUpperCase() + trade.slice(1) : "",
      };
    });
  }, [memberIds, marksByDay, workDate, cid, labourQ.data, crew]);

  const workLines = useMemo(() => {
    const lines = Array.isArray(projectQ.data?.budgetLines) ? (projectQ.data.budgetLines as AthenaRecord[]) : [];
    return lines.filter((line) => line.kind === "work" || line.billingMethod);
  }, [projectQ.data]);

  function savedQty(mark: AthenaRecord | undefined, lineId: string) {
    const rows = Array.isArray(mark?.workDone) ? (mark.workDone as AthenaRecord[]) : [];
    const found = rows.find((row) => String(row.lineId) === lineId);
    return found ? String(found.quantity ?? "") : "";
  }

  function qtyValue(workerId: string, lineId: string, mark: AthenaRecord | undefined) {
    return workQty[workerId]?.[lineId] ?? savedQty(mark, lineId);
  }

  function workPayload(workerId: string, mark: AthenaRecord | undefined) {
    return workLines
      .map((line) => ({
        lineId: String(line.id),
        description: String(line.description || ""),
        quantity: qtyValue(workerId, String(line.id), mark).trim() || "0",
        unit: String(line.unit || ""),
        billingMethod: line.billingMethod ? String(line.billingMethod) : undefined,
      }))
      .filter((row) => Number(row.quantity) > 0);
  }

  const dayMarks = workDate ? marksByDay.get(workDate) : undefined;
  const counts = useMemo(() => {
    const out: Record<AttendanceStatus, number> = { present: 0, half_day: 0, leave: 0 };
    let marked = 0;
    for (const w of workers) {
      const meta = statusMeta(dayMarks?.get(w.id)?.status);
      if (!meta) continue;
      marked += 1;
      out[meta.id] += 1;
    }
    return { ...out, marked };
  }, [workers, dayMarks]);

  function dayProgress(day: string) {
    const marks = marksByDay.get(day);
    if (!marks || memberIds.length === 0) return "none" as const;
    const done = memberIds.filter((id) => marks.has(id)).length;
    if (done === 0) return "none" as const;
    return done >= memberIds.length ? ("done" as const) : ("partial" as const);
  }

  async function setStatus(worker: Worker, status: AttendanceStatus) {
    if (!workDate || busy) return;
    const existing = dayMarks?.get(worker.id);
    const current = statusMeta(existing?.status);
    const next = statusMeta(status)!;
    if (existing && current?.id === status) {
      confirmClear(worker, existing);
      return;
    }
    setBusy(worker.id);
    try {
      if (existing) {
        await update.mutateAsync({
          id: String(existing.id),
          status,
          workDone: status === "leave" ? [] : workPayload(worker.id, existing),
        });
        Toast.show({
          type: "success",
          text1: "Attendance updated",
          text2: `${worker.name}: ${current?.label ?? "Not marked"} → ${next.label} · ${dayLabel(workDate)}`,
        });
      } else {
        await create.mutateAsync({
          projectId: pid,
          crewId: cid,
          workerId: worker.id,
          status,
          date: workDate,
          overtimeHours: "0",
          workDone: status === "leave" ? [] : workPayload(worker.id, undefined),
        });
        Toast.show({
          type: "success",
          text1: `${worker.name} marked ${next.label.toLowerCase()}`,
          text2: dayLabel(workDate),
          visibilityTime: 1800,
        });
      }
    } catch (e) {
      if (errorCode(e) === "worker_double_booked") Alert.alert(`${worker.name} already worked on another project`, errorText(e));
      else Toast.show({ type: "error", text1: "Couldn't save attendance", text2: errorText(e) });
    } finally {
      setBusy(null);
    }
  }

  function confirmClear(worker: Worker, existing: AthenaRecord) {
    if (!workDate) return;
    const day = dayLabel(workDate);
    Alert.alert("Clear attendance?", `${worker.name}'s attendance for ${day} will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setBusy(worker.id);
          try {
            await clear.mutateAsync(String(existing.id));
            Toast.show({ type: "success", text1: "Attendance cleared", text2: `${worker.name} · ${day}` });
          } catch (e) {
            Toast.show({ type: "error", text1: "Couldn't clear attendance", text2: errorText(e) });
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  async function markAllPresent() {
    if (!workDate || busy) return;
    const pending = workers.filter((w) => !dayMarks?.has(w.id));
    if (pending.length === 0) return;
    setBusy("all");
    let saved = 0;
    let firstError: unknown = null;
    for (const w of pending) {
      try {
        await create.mutateAsync({ projectId: pid, crewId: cid, workerId: w.id, status: "present", date: workDate, overtimeHours: "0" });
        saved += 1;
      } catch (e) {
        firstError = firstError ?? e;
      }
    }
    setBusy(null);
    if (saved > 0) {
      Toast.show({
        type: "success",
        text1: `${saved} worker${saved === 1 ? "" : "s"} marked present`,
        text2: dayLabel(workDate),
      });
    }
    if (firstError) {
      const failed = pending.length - saved;
      if (errorCode(firstError) === "worker_double_booked") {
        Alert.alert(
          `${failed} worker${failed === 1 ? "" : "s"} already worked on another project`,
          `${errorText(firstError)}\n\nTo stop this, schedule each crew on only one project for the same days.`,
        );
        return;
      }
      Toast.show({
        type: "error",
        text1: `Couldn't mark ${failed} worker${failed === 1 ? "" : "s"}`,
        text2: errorText(firstError),
      });
    }
  }

  const editSpan = spans.find((s) => workDate && s.start <= workDate && workDate <= s.end) ?? spans[0];
  const projectName = String(projectQ.data?.name || projectQ.data?.number || "Project");
  const loading = schedulesQ.isLoading || crewsQ.isLoading || attendanceQ.isLoading;
  const loadError = schedulesQ.error || attendanceQ.error || crewsQ.error;
  const pendingCount = workers.length - counts.marked;
  const upcoming = spans.filter((s) => s.start > today);

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={attendanceQ.isRefetching || schedulesQ.isRefetching}
              tintColor={p.clay}
              onRefresh={() => {
                attendanceQ.refetch();
                schedulesQ.refetch();
                crewsQ.refetch();
                labourQ.refetch();
              }}
            />
          }
        >
          <ScreenHeader
            title={String(crew?.name || "Crew")}
            subtitle={projectName}
            onBack={() => router.back()}
            right={
              editSpan ? (
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => router.push(`/(tabs)/more/schedule/${editSpan.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit schedule dates"
                  hitSlop={6}
                >
                  <PencilLine size={18} color={p.text} strokeWidth={2.3} />
                </Pressable>
              ) : null
            }
          />

          {loadError ? (
            <ErrorBanner
              message={(loadError as { userMessage?: string })?.userMessage || "Couldn't load attendance."}
              onRetry={() => {
                schedulesQ.refetch();
                attendanceQ.refetch();
                crewsQ.refetch();
              }}
            />
          ) : null}
          {loading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 16 }} /> : null}

          {!loading && spans.length === 0 ? (
            <EmptyState
              title="Crew not scheduled"
              subtitle="This crew isn't scheduled on this project. Schedule it with a start and expected end date to mark attendance."
              actionLabel="Schedule a crew"
              onAction={() => router.push(`/(tabs)/more/schedule/new?projectId=${pid}` as never)}
            />
          ) : null}

          {spans.length > 0 ? (
            <View style={styles.scheduleCard}>
              <View style={styles.scheduleIcon}>
                <CalendarDays size={18} color={p.clayDark} strokeWidth={2.3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.scheduleLabel}>Scheduled</Text>
                <Text style={styles.scheduleValue}>{spans.map((s) => rangeLabel(s.start, s.end)).join(", ")}</Text>
              </View>
            </View>
          ) : null}

          {spans.length > 0 && days.length === 0 && upcoming.length > 0 ? (
            <View style={styles.notice}>
              <CalendarClock size={22} color={p.blue} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Attendance opens on {dayLabel(upcoming[0].start)}</Text>
                <Text style={styles.noticeText}>Workers can be marked from the scheduled start date.</Text>
              </View>
            </View>
          ) : null}

          {workDate ? (
            <>
              <FlatList
                horizontal
                data={days}
                keyExtractor={(d) => d}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateRow}
                getItemLayout={(_, index) => ({ length: CHIP + CHIP_GAP, offset: (CHIP + CHIP_GAP) * index, index })}
                initialScrollIndex={Math.max(0, days.indexOf(workDate) - 3)}
                renderItem={({ item }) => {
                  const on = item === workDate;
                  const progress = dayProgress(item);
                  const d = parseDay(item);
                  return (
                    <Pressable
                      style={[styles.dateChip, on && styles.dateChipOn]}
                      onPress={() => setPicked(item)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={dayLabel(item)}
                    >
                      <Text style={[styles.dateWeek, on && styles.dateOnText]}>
                        {item === today ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" })}
                      </Text>
                      <Text style={[styles.dateDay, on && styles.dateOnText]}>{d.getDate()}</Text>
                      <Text style={[styles.dateMonth, on && styles.dateOnText]}>
                        {d.toLocaleDateString("en-GB", { month: "short" })}
                      </Text>
                      <View
                        style={[
                          styles.progressDot,
                          progress === "done" && { backgroundColor: on ? "#fff" : p.green },
                          progress === "partial" && { backgroundColor: on ? "#FED7AA" : p.amber },
                        ]}
                      />
                    </Pressable>
                  );
                }}
              />

              <View style={styles.summary}>
                <View style={styles.summaryHead}>
                  <View>
                    <Text style={styles.summaryDate}>{dayLabel(workDate)}</Text>
                    <Text style={styles.summaryCount}>
                      {counts.marked} of {workers.length} marked
                    </Text>
                  </View>
                  {pendingCount > 0 ? (
                    <Pressable
                      style={[styles.allBtn, busy !== null && styles.disabled]}
                      onPress={markAllPresent}
                      disabled={busy !== null}
                      accessibilityRole="button"
                    >
                      {busy === "all" ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <CheckCheck size={16} color="#fff" strokeWidth={2.6} />
                          <Text style={styles.allBtnText}>All present</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.trackFill,
                      {
                        width: `${workers.length ? Math.round((counts.marked / workers.length) * 100) : 0}%` as `${number}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.countRow}>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <StatePill key={s.id} label={`${s.label} ${counts[s.id]}`} tone={s} />
                  ))}
                </View>
              </View>

              {workers.length === 0 && !loading ? (
                <EmptyState
                  title="No workers in this crew"
                  subtitle="Add workers to the crew to mark their attendance."
                  actionLabel="Edit crew"
                  onAction={() => router.push(`/(tabs)/labour/crews/${cid}` as never)}
                />
              ) : null}

              {workers.map((w) => {
                const mark = dayMarks?.get(w.id);
                const meta = statusMeta(mark?.status);
                const rowBusy = busy === w.id;
                return (
                  <View key={w.id} style={styles.workerCard}>
                    <View style={styles.workerHead}>
                      <Avatar name={w.name} seed={w.id} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.workerName} numberOfLines={1}>
                          {w.name}
                        </Text>
                        {w.trade ? <Text style={styles.workerTrade}>{w.trade}</Text> : null}
                      </View>
                      {rowBusy ? (
                        <ActivityIndicator color={p.clay} size="small" />
                      ) : meta ? (
                        <StatePill label={meta.label} tone={meta} />
                      ) : (
                        <StatePill label="Not marked" tone={{ color: p.faint, soft: p.slateSoft }} />
                      )}
                    </View>
                    <View style={styles.segment}>
                      {ATTENDANCE_STATUSES.map((s) => {
                        const on = meta?.id === s.id;
                        return (
                          <Pressable
                            key={s.id}
                            style={[
                              styles.segBtn,
                              { borderColor: on ? s.color : p.borderStrong },
                              on && { backgroundColor: s.color },
                              busy !== null && !rowBusy && styles.dim,
                            ]}
                            onPress={() => setStatus(w, s.id)}
                            disabled={busy !== null}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={`${w.name} ${s.label}`}
                            accessibilityHint={on ? "Double tap to clear this mark" : undefined}
                          >
                            <Text style={[styles.segText, { color: on ? "#fff" : p.text }]}>{s.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {workLines.length > 0 && meta?.id !== "leave" ? (
                      <View style={styles.workBox}>
                        <Text style={styles.workTitle}>Work done today</Text>
                        <Text style={styles.workHint}>From the quotation. Enter only what {w.name.split(" ")[0]} finished. It is saved when you mark attendance.</Text>
                        {workLines.map((line) => {
                          const lineId = String(line.id);
                          return (
                            <View key={lineId} style={styles.workRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.workName} numberOfLines={2}>
                                  {String(line.description || "Quoted work")}
                                </Text>
                                <Text style={styles.workMeta}>
                                  Quoted {String(line.quantity || "")} {String(line.unit || "")}
                                  {line.billingMethod ? ` · ${String(line.billingMethod)}` : ""}
                                </Text>
                              </View>
                              <TextInput
                                value={qtyValue(w.id, lineId, mark)}
                                onChangeText={(text) =>
                                  setWorkQty((prev) => ({ ...prev, [w.id]: { ...prev[w.id], [lineId]: text.replace(/[^0-9.]/g, "") } }))
                                }
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={p.faint}
                                style={styles.workInput}
                                accessibilityLabel={workHint(line)}
                              />
                            </View>
                          );
                        })}
                        {mark && meta && meta.id !== "leave" ? (
                          <Pressable
                            style={[styles.saveWork, rowBusy && styles.disabled]}
                            disabled={busy !== null}
                            onPress={() => {
                              setBusy(w.id);
                              update
                                .mutateAsync({ id: String(mark.id), status: meta.id, workDone: workPayload(w.id, mark) })
                                .then(() => Toast.show({ type: "success", text1: "Work done saved", text2: `${w.name} · ${dayLabel(workDate)}` }))
                                .catch((e) => Toast.show({ type: "error", text1: "Couldn't save work done", text2: errorText(e) }))
                                .finally(() => setBusy(null));
                            }}
                          >
                            <Text style={styles.saveWorkText}>Save work done</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
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
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    ...softShadow,
  },
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: 14,
  },
  scheduleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: p.clayMid,
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleLabel: { color: p.muted, fontSize: 12, fontWeight: "600" },
  scheduleValue: { color: p.text, fontSize: 15, fontWeight: "700", marginTop: 2 },
  notice: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: p.blueSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  noticeTitle: { color: p.text, fontWeight: "700", fontSize: 15 },
  noticeText: { color: p.muted, fontSize: 13, marginTop: 2 },
  dateRow: { gap: CHIP_GAP, paddingBottom: 4, marginBottom: 14 },
  dateChip: {
    width: CHIP,
    borderRadius: radius.lg,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
  },
  dateChipOn: { backgroundColor: p.clay, borderColor: p.clay, ...softShadow },
  dateWeek: { color: p.muted, fontSize: 11, fontWeight: "700" },
  dateDay: { color: p.text, fontSize: 20, fontWeight: "800", marginVertical: 1 },
  dateMonth: { color: p.muted, fontSize: 11, fontWeight: "600" },
  dateOnText: { color: "#fff" },
  progressDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, backgroundColor: "transparent" },
  summary: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: 14,
    ...softShadow,
  },
  summaryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryDate: { color: p.muted, fontSize: 12, fontWeight: "700" },
  summaryCount: { color: p.text, fontSize: 18, fontWeight: "800", marginTop: 2 },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: p.green,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 112,
    justifyContent: "center",
  },
  allBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  track: { height: 6, borderRadius: 3, backgroundColor: p.slateSoft, marginTop: 12, overflow: "hidden" },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: p.green },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  workerCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: 10,
    ...softShadow,
  },
  workerHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  workerName: { color: p.text, fontSize: 16, fontWeight: "700" },
  workerTrade: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  workBox: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.border },
  workTitle: { color: p.text, fontWeight: "800", fontSize: 14 },
  workHint: { color: p.muted, fontSize: 12, marginTop: 2, marginBottom: 8, lineHeight: 17 },
  workRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  workName: { color: p.text, fontWeight: "700", fontSize: 13 },
  workMeta: { color: p.muted, fontSize: 11, marginTop: 2 },
  workInput: {
    width: 72,
    borderWidth: 1,
    borderColor: p.borderStrong,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    textAlign: "right",
    color: p.text,
    backgroundColor: p.surface,
  },
  saveWork: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: p.claySoft },
  saveWorkText: { color: p.clayDark, fontWeight: "800", fontSize: 13 },
  segment: { flexDirection: "row", gap: 8 },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: p.surface,
  },
  segText: { fontWeight: "700", fontSize: 13 },
  dim: { opacity: 0.5 },
  disabled: { opacity: 0.6 },
});
