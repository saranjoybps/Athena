import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useCreateInvoice,
  useProjectAttendance,
  useProjectSchedules,
  useCrews,
  useLabour,
  useExpenses,
  useMaterials,
  useProject,
  useQuote,
  useUpdateInvoice,
  useUpdateProject,
  useEstimate,
  useOrgBranding,
} from "@/hooks/useApi";
import { orgDays } from "@/lib/organization";
import { openInvoiceDrawerOnReturn } from "@/components/invoices/InvoiceDrawer";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DateField } from "@/components/ui/DateField";
import { formatCurrency } from "@/lib/format";
import { projectPath } from "@/lib/nav";
import { materialSelectOptions } from "@/lib/materialOptions";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";
import { dayLabel, localIso, markDay, parseDay } from "@/lib/attendance";
import { memberIdsFromCrew } from "@/components/people/CrewFormScreen";

type InvoiceLine = {
  id: string;
  description: string;
  amount: string;
  quantity: string;
  unit: string;
  rate: string;
  labourCost: string;
  gstRate: string;
  hsn?: string;
  catalogMaterialId?: string;
  kind?: string;
  billingMethod?: string;
  sourceLineId?: string;
  source?: "work" | "estimate" | "expense" | "material" | "labour";
};

type MaterialOpt = {
  id: string;
  name: string;
  unit?: string;
  purchase?: string;
  selling?: string;
  gstRate?: string;
  hsn?: string;
};

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function newId() {
  return `il-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function amountFromRawLine(line: Record<string, unknown>): number {
  if (line.amount != null && line.amount !== "" && Number(line.amount) > 0) return Number(line.amount);
  const qty = Number(line.quantity || 0);
  const rate = Number(line.rate || line.unitPrice || 0);
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(qty) && qty > 0) return qty * rate;
  return 0;
}

function lineGroup(line: { kind?: string; billingMethod?: string; category?: string; source?: string }): "labour" | "material" | "tool" | "other" {
  const kind = String(line.kind || "").toLowerCase();
  const method = String(line.billingMethod || "").toLowerCase();
  const category = String(line.category || "").toLowerCase();
  if (kind === "material" || category.startsWith("material") || line.source === "material") return "material";
  if (kind === "tool" || category.startsWith("tool") || category.startsWith("equipment")) return "tool";
  if (kind === "work" || kind === "labour" || ["area", "quantity", "length", "time", "fixed"].includes(method) || category.startsWith("labour")) return "labour";
  return "other";
}

function linesFromDoc(doc: Record<string, unknown> | undefined | null): Omit<InvoiceLine, "id" | "source">[] {
  if (!doc) return [];
  const normalized = (doc.line_items as Array<Record<string, unknown>>) || [];
  if (normalized.length) {
    return normalized.map((line) => ({
      description: String(line.description || "Estimate line"),
      amount: String(line.subtotal || line.total || "0"),
      quantity: String(line.quantity || "1"),
      unit: String(line.unit || ""),
      rate: String(line.unit_price || ""),
      labourCost: "0",
      gstRate: "",
      kind: String(line.kind || ""),
      billingMethod: String(line.billingMethod || ""),
      sourceLineId: String(line.id || ""),
    }));
  }
  const raw = (doc.items as Array<Record<string, unknown>>) || [];
  return raw
    .map((line) => {
      const amount = amountFromRawLine(line);
      const qty = Number(line.quantity || 1) || 1;
      const rate = Number(line.rate || 0) > 0 ? Number(line.rate) : amount / qty;
      const gstRaw = line.gstRate != null ? Number(line.gstRate) : NaN;
      const gstPct =
        Number.isFinite(gstRaw) && gstRaw > 0 ? (gstRaw <= 1 ? String(gstRaw * 100) : String(gstRaw)) : "";
      return {
        description: String(line.description || "Estimate line"),
        amount: String(Number.isFinite(amount) ? amount : 0),
        quantity: String(qty),
        unit: String(line.unit || ""),
        rate: String(Number.isFinite(rate) ? rate : 0),
        labourCost: "0",
        gstRate: gstPct,
        kind: String(line.kind || ""),
        billingMethod: String(line.billingMethod || ""),
        sourceLineId: String(line.id || line.sourceLineId || ""),
      };
    })
    .filter((line) => Number(line.amount) > 0 || Boolean(line.description));
}

export default function NewInvoice() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const router = useRouter();
  const project = useProject(projectId);
  const quoteId = project.data?.quoteId ? String(project.data.quoteId) : undefined;
  const quote = useQuote(quoteId);
  const estimateId = quote.data?.estimateId ? String(quote.data.estimateId) : undefined;
  const estimate = useEstimate(estimateId);
  const expenses = useExpenses(projectId, Boolean(projectId));
  const schedules = useProjectSchedules(projectId);
  const attendance = useProjectAttendance(projectId);
  const crews = useCrews();
  const workers = useLabour();
  const { data: materialsData } = useMaterials();
  const create = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const updateProject = useUpdateProject();
  const [notes, setNotes] = useState("");
  const branding = useOrgBranding();
  const dueDays = orgDays(branding.data?.invoice_due_days);
  const [dueDate, setDueDate] = useState(plusDaysIso(dueDays));
  const [dueTouched, setDueTouched] = useState(false);
  useEffect(() => {
    if (!dueTouched) setDueDate(plusDaysIso(dueDays));
  }, [dueDays, dueTouched]);
  const [completed, setCompleted] = useState(false);
  const [gstPercent, setGstPercent] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [labourMode, setLabourMode] = useState<"estimate" | "actual">("estimate");
  const [seeded, setSeeded] = useState(false);
  const scheduledCrewIds = useMemo(() => [...new Set((schedules.data?.items ?? [])
    .filter((s) => String(s.projectId || "") === String(projectId || ""))
    .map((s) => String(s.crewId || "")).filter(Boolean))], [schedules.data, projectId]);
  const scheduledCrewMembers = useMemo(() => {
    const result = new Map<string, string[]>();
    const allCrews = crews.data?.items ?? [];
    for (const cid of scheduledCrewIds) {
      const crew = allCrews.find((c) => String(c.id) === cid);
      result.set(cid, memberIdsFromCrew(crew?.members));
    }
    return result;
  }, [scheduledCrewIds, crews.data]);
  const scheduledDays = useMemo(() => {
    const days = new Map<string, string[]>();
    const today = localIso();
    for (const s of schedules.data?.items ?? []) {
      if (String(s.projectId || "") !== String(projectId || "")) continue;
      const start = String(s.startDate || "").slice(0, 10);
      const end = String(s.endDate || s.startDate || "").slice(0, 10);
      const crewId = String(s.crewId || "");
      if (!crewId || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) continue;
      const through = end < today ? end : today;
      for (let d = parseDay(start); localIso(d) <= through; d.setDate(d.getDate() + 1)) {
        const day = localIso(d);
        const crewsForDay = days.get(day) ?? [];
        if (!crewsForDay.includes(crewId)) crewsForDay.push(crewId);
        days.set(day, crewsForDay);
      }
    }
    return days;
  }, [schedules.data, projectId]);
  const attendanceSummary = useMemo(() => {
    const marks = attendance.data?.items ?? [];
    const workerList = workers.data?.items ?? [];
    let total = 0;
    const missing = new Set<string>();
    for (const [day, crewIds] of scheduledDays) {
      for (const crewId of crewIds) {
        const memberIds = scheduledCrewMembers.get(crewId) ?? [];
        for (const workerId of memberIds) {
          const mark = marks.find((m) => markDay(m) === day && String(m.workerId || "") === workerId && String(m.crewId || "") === crewId);
          if (!mark) { missing.add(day); continue; }
          const rate = Number(workerList.find((w) => String(w.id) === workerId)?.dailyRate || 0);
          const status = String(mark.status || "");
          if (status === "present" || status === "overtime") total += rate;
          else if (status === "half_day") total += rate / 2;
        }
      }
    }
    return { total, missingDates: [...missing].sort() };
  }, [attendance.data, workers.data, scheduledDays, scheduledCrewMembers]);
  const hasSchedules = scheduledCrewIds.length > 0;
  const completedByLine = useMemo(() => {
    const map: Record<string, number> = {};
    for (const mark of attendance.data?.items ?? []) {
      const rows = Array.isArray(mark.workDone) ? (mark.workDone as Array<Record<string, unknown>>) : [];
      for (const item of rows) {
        const lineId = String(item.lineId || "");
        if (!lineId) continue;
        map[lineId] = (map[lineId] || 0) + (Number(item.quantity) || 0);
      }
    }
    return map;
  }, [attendance.data]);

  const materials: MaterialOpt[] = useMemo(
    () =>
      (materialsData?.items ?? []).map((m) => ({
        id: String(m.id),
        name: String(m.name || m.sku || m.id),
        unit: m.unit ? String(m.unit) : undefined,
        purchase: m.defaultPurchasePrice ? String(m.defaultPurchasePrice) : undefined,
        selling: m.defaultSellingPrice ? String(m.defaultSellingPrice) : undefined,
        gstRate: m.gstRate != null ? String(m.gstRate) : undefined,
        hsn: m.hsn ? String(m.hsn) : undefined,
      })),
    [materialsData],
  );
  const materialOptions = useMemo(() => materialSelectOptions(materials), [materials]);

  const billableExpenses = useMemo(
    () => (expenses.data?.items || []).filter((e) => e.billableToCustomer === true),
    [expenses.data],
  );

  useEffect(() => {
    setSeeded(false);
    setLines([]);
  }, [projectId, labourMode]);

  useEffect(() => {
    if (!project.data || seeded) return;
    if (quoteId && quote.isLoading) return;
    if (estimateId && estimate.isLoading) return;
    if (expenses.isLoading) return;

    let estimateLines = linesFromDoc(quote.data as Record<string, unknown> | undefined);
    if (!estimateLines.length) {
      estimateLines = linesFromDoc(estimate.data as Record<string, unknown> | undefined);
    }

    const next: InvoiceLine[] = [];
    const categoryOf = (value: unknown) => String(value || "").toLowerCase();
    const materialActual = billableExpenses.filter((e) => categoryOf(e.category).startsWith("material"));
    const toolActual = billableExpenses.filter((e) => categoryOf(e.category).startsWith("tool") || categoryOf(e.category).startsWith("equipment"));
    const otherActual = billableExpenses.filter((e) => {
      const cat = categoryOf(e.category);
      return !cat.startsWith("material") && !cat.startsWith("tool") && !cat.startsWith("equipment") && !cat.startsWith("labour") && !cat.startsWith("labor") && !cat.startsWith("wage");
    });
    const replace = new Set<string>();
    if (materialActual.length) replace.add("material");
    if (toolActual.length) replace.add("tool");
    if (otherActual.length) replace.add("other");
    if (estimateLines.length) {
      const loggedTotal = Object.values(completedByLine).reduce((sum, qty) => sum + qty, 0);
      const labourLines = estimateLines.filter((line) => lineGroup(line) === "labour");
      for (const line of estimateLines) {
        const group = lineGroup(line);
        if (replace.has(group)) continue;
        const nextLine: InvoiceLine = { ...line, id: newId(), source: "estimate" };
        if (labourMode === "actual" && group === "labour" && line.billingMethod !== "fixed" && line.unit !== "job") {
          const matched = line.sourceLineId ? completedByLine[line.sourceLineId] : undefined;
          const quantity = matched != null ? matched : labourLines.length === 1 ? loggedTotal : 0;
          const rate = Number(line.rate) || 0;
          nextLine.quantity = String(quantity);
          nextLine.amount = String(quantity * rate);
        }
        next.push(nextLine);
      }
      const pushExpense = (exp: (typeof billableExpenses)[number], group: InvoiceLine["kind"]) => {
        const amt = String(exp.amount || "0");
        next.push({
          id: newId(),
          description: String(exp.description || exp.category || group),
          amount: amt,
          quantity: "1",
          unit: group || "",
          rate: amt,
          labourCost: "0",
          gstRate: "",
          kind: group,
          source: "expense",
        });
      };
      materialActual.forEach((exp) => pushExpense(exp, "material"));
      toolActual.forEach((exp) => pushExpense(exp, "tool"));
      otherActual.forEach((exp) => pushExpense(exp, "other"));
    } else {
      const contract = Number(project.data.contractValue || 0);
      const billed = Number(project.data.billedToDate || 0);
      const remaining = Math.max(0, contract - billed);
      const value = remaining || contract || 0;
      if (value > 0) {
        next.push({
          id: newId(),
          description: String(project.data.name || "Project work"),
          amount: String(value),
          quantity: "1",
          unit: "",
          rate: String(value),
          labourCost: "0",
          gstRate: "",
          source: "work",
        });
      }
    }

    setLines(next);
    setSeeded(true);
  }, [
    project.data,
    quote.data,
    quote.isLoading,
    quoteId,
    estimate.data,
    estimate.isLoading,
    estimateId,
    expenses.isLoading,
    billableExpenses,
    seeded,
    labourMode,
    completedByLine,
  ]);

  function updateLine(id: string, patch: Partial<InvoiceLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (patch.quantity !== undefined || patch.rate !== undefined || patch.labourCost !== undefined) {
          const qty = Number(next.quantity || 0);
          const rate = Number(next.rate || 0);
          if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate)) {
            next.amount = String(qty * rate);
          }
        }
        return next;
      }),
    );
  }

  function addBlankLine() {
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        description: "",
        amount: "0",
        quantity: "1",
        unit: "pcs",
        rate: "0",
        labourCost: "0",
        gstRate: "",
        source: "material",
      },
    ]);
  }

  function addMaterial(material: MaterialOpt) {
    const rate = material.selling || material.purchase || "0";
    const gst = Number(material.gstRate);
    const gstPct = Number.isFinite(gst) && gst > 0 ? String(Number((gst <= 1 ? gst * 100 : gst).toFixed(2))) : "";
    setLines((prev) => [
      ...prev,
      {
        id: newId(),
        description: material.name,
        quantity: "1",
        unit: material.unit || "pcs",
        rate,
        labourCost: "0",
        gstRate: gstPct,
        hsn: material.hsn,
        catalogMaterialId: material.id,
        amount: String(Number(rate || 0)),
        source: "material",
      },
    ]);
  }

  const linesSubtotal = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    [lines],
  );

  // Blank invoice GST falls back to the highest line GST (material rates), matching the API's rule.
  const lineGstPercent = useMemo(
    () => lines.reduce((max, line) => Math.max(max, Number(line.gstRate) || 0), 0),
    [lines],
  );
  const effectiveGstPercent = gstPercent.trim() ? Number(gstPercent.trim()) || 0 : lineGstPercent;

  const gstAmount = useMemo(
    () => (effectiveGstPercent > 0 ? linesSubtotal * (effectiveGstPercent / 100) : 0),
    [linesSubtotal, effectiveGstPercent],
  );

  const chargeTotals = useMemo(() => {
    const totals = { labour: 0, material: 0, tool: 0, other: 0 };
    for (const line of lines) totals[lineGroup(line)] += Number(line.amount || 0);
    return totals;
  }, [lines]);
  const invoiceTotal = linesSubtotal + gstAmount;

  async function submit() {
    if (!projectId) {
      Toast.show({ type: "error", text1: "Open Create invoice from a project" });
      return;
    }
    if (!lines.length) {
      Toast.show({ type: "error", text1: "Add estimate lines, materials, or expenses" });
      return;
    }
    if (!dueDate) {
      Toast.show({ type: "error", text1: "Due date is required" });
      return;
    }
    const taxRate = effectiveGstPercent > 0 ? String(effectiveGstPercent / 100) : "0";
    try {
      const invoice = await create.mutateAsync({
        body: {
          projectId,
          kind: completed ? "final" : "progress",
          overrideCap: true,
          taxRate,
          items: lines.map(({ description, amount, quantity, unit, rate, labourCost, gstRate, hsn, catalogMaterialId }) => {
            const linePct = Number(gstRate || 0);
            return {
              description,
              amount,
              quantity,
              unit,
              rate,
              labourCost: labourCost || "0",
              gstRate: Number.isFinite(linePct) && linePct > 0 ? String(linePct / 100) : undefined,
              hsn: hsn || undefined,
              catalogMaterialId: catalogMaterialId || undefined,
            };
          }),
        },
        key: `mobile-inv-${projectId}-${Date.now()}`,
      });
      if (project.data?.status === "scheduled") {
        await updateProject.mutateAsync({ id: projectId, body: { status: "active" } });
      }
      if (invoice.id) {
        await updateInvoice.mutateAsync({
          id: String(invoice.id),
          body: {
            notes: notes.trim() || null,
            dueDate: dueDate || null,
          },
        });
      }
      Toast.show({ type: "success", text1: `Invoice ${String(invoice.number || "")} created`.replace("  ", " "), text2: "Review it, then send it to the customer." });
      openInvoiceDrawerOnReturn(String(invoice.id));
      router.replace(projectPath(String(projectId), "money") as never);
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Create invoice"
          subtitle={project.data ? String(project.data.name || project.data.number || "") : "Project money"}
          onBack={() =>
            router.replace((projectId ? projectPath(projectId, "money") : "/(tabs)/projects") as never)
          }
        />

        {!projectId ? <Text style={styles.err}>Open Create invoice from a project’s Money tab.</Text> : null}
        {project.isLoading ? <ActivityIndicator color={p.clay} /> : null}

        {project.data ? (
          <>
            <View style={styles.totalHero}>
              <Text style={styles.totalHeroLabel}>Grand total</Text>
              <Text style={styles.totalHeroAmt}>{formatCurrency(String(invoiceTotal))}</Text>
              <Text style={styles.totalHeroMeta}>
                Contract {formatCurrency(String(project.data.contractValue || 0))} · Billed{" "}
                {formatCurrency(String(project.data.billedToDate || 0))}
              </Text>
            </View>

            {project.data.quoteId && Number(project.data.billedToDate || 0) > 0 ? (
              <View style={styles.attendWarn}>
                <Text style={styles.attendWarnTitle}>
                  {Number(project.data.billedToDate || 0) >= Number(project.data.contractValue || 0)
                    ? "Contract is fully billed"
                    : `Left to bill: ${formatCurrency(String(Math.max(0, Number(project.data.contractValue || 0) - Number(project.data.billedToDate || 0))))}`}
                </Text>
                <Text style={styles.attendWarnBody}>
                  The lines below are copied from the full estimate. Edit or remove them so this invoice only covers work not billed yet. For extra work, add a change order on the project first.
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Labour billing</Text>
              <Text style={styles.hint}>Worker wages stay a project expense. They are not added to this invoice.</Text>
              <Pressable style={[styles.toggle, labourMode === "estimate" && styles.toggleOn]} onPress={() => setLabourMode("estimate")}>
                <Text style={[styles.toggleText, labourMode === "estimate" && styles.toggleTextOn]}>Keep estimated labour charges</Text>
              </Pressable>
              <Pressable style={[styles.toggle, labourMode === "actual" && styles.toggleOn]} onPress={() => setLabourMode("actual")}>
                <Text style={[styles.toggleText, labourMode === "actual" && styles.toggleTextOn]}>Synchronize actual completed work</Text>
              </Pressable>
              {hasSchedules ? (
                <Text style={styles.summaryHint}>Actual worker wages recorded: {formatCurrency(String(attendanceSummary.total))}. Not included.</Text>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Invoice details</Text>
              <DateField
                label="Due date *"
                value={dueDate}
                onChange={(v) => {
                  setDueTouched(true);
                  setDueDate(v);
                }}
              />
              <Text style={styles.label}>GST %</Text>
              <TextInput
                style={styles.input}
                value={gstPercent}
                onChangeText={setGstPercent}
                keyboardType="decimal-pad"
                placeholder={lineGstPercent > 0 ? `${lineGstPercent} (from materials)` : "Optional"}
                placeholderTextColor={p.faint}
              />
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multi]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Payment terms, bank details…"
                placeholderTextColor={p.faint}
              />
              <Pressable style={[styles.toggle, completed && styles.toggleOn]} onPress={() => setCompleted((v) => !v)}>
                <Text style={[styles.toggleText, completed && styles.toggleTextOn]}>
                  {completed ? "✓ Final invoice — project completes once it's paid" : "Progress invoice — keep project active"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.linesHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Line items</Text>
                  <Text style={styles.hint}>
                    {lines.length} line{lines.length === 1 ? "" : "s"} · edit qty or rate to recalc
                  </Text>
                </View>
              </View>

              <SelectDropdown
                actionMode
                options={materialOptions}
                value=""
                onChange={(materialId) => {
                  const material = materials.find((m) => m.id === materialId);
                  if (material) addMaterial(material);
                }}
                placeholder="+ Add material from catalog"
                searchPlaceholder="Search materials"
                emptyText="No materials in your catalog yet."
              />
              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtnGhost} onPress={addBlankLine}>
                  <Text style={styles.actionBtnGhostText}>+ Blank line</Text>
                </Pressable>
              </View>

              {lines.length === 0 ? (
                <Text style={[styles.hint, { marginTop: 8 }]}>No lines yet — add a material or blank line.</Text>
              ) : (
                lines.map((line, idx) => (
                  <View key={line.id} style={styles.lineCard}>
                    <View style={styles.lineHead}>
                      <View style={styles.lineBadge}>
                        <Text style={styles.lineBadgeText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.lineSource}>
                        {line.source === "material"
                          ? "material"
                          : line.source === "estimate"
                            ? "estimate"
                            : line.source === "expense"
                              ? "expense"
                              : "line"}
                      </Text>
                      <Pressable onPress={() => setLines((prev) => prev.filter((l) => l.id !== line.id))} hitSlop={8}>
                        <Text style={styles.remove}>Remove</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={line.description}
                      onChangeText={(v) => updateLine(line.id, { description: v })}
                      placeholder="Description"
                      placeholderTextColor={p.faint}
                    />
                    <View style={styles.qtyRow}>
                      <View style={styles.qtyCol}>
                        <Text style={styles.miniLabel}>Qty</Text>
                        <TextInput
                          style={styles.input}
                          value={line.quantity}
                          onChangeText={(v) => updateLine(line.id, { quantity: v })}
                          keyboardType="decimal-pad"
                          placeholderTextColor={p.faint}
                        />
                      </View>
                      <View style={styles.qtyCol}>
                        <Text style={styles.miniLabel}>Unit</Text>
                        <TextInput
                          style={styles.input}
                          value={line.unit}
                          onChangeText={(v) => updateLine(line.id, { unit: v })}
                          placeholderTextColor={p.faint}
                        />
                      </View>
                      <View style={styles.qtyCol}>
                        <Text style={styles.miniLabel}>Rate</Text>
                        <TextInput
                          style={styles.input}
                          value={line.rate}
                          onChangeText={(v) => updateLine(line.id, { rate: v })}
                          keyboardType="decimal-pad"
                          placeholderTextColor={p.faint}
                        />
                      </View>
                      <View style={styles.qtyCol}>
                        <Text style={styles.miniLabel}>Labour</Text>
                        <TextInput
                          style={styles.input}
                          value={line.labourCost}
                          onChangeText={(v) => updateLine(line.id, { labourCost: v })}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={p.faint}
                        />
                      </View>
                    </View>
                    <View style={styles.qtyRow}>
                      <View style={styles.qtyCol}>
                        <Text style={styles.miniLabel}>GST %</Text>
                        <TextInput
                          style={styles.input}
                          value={line.gstRate}
                          onChangeText={(v) => updateLine(line.id, { gstRate: v })}
                          keyboardType="decimal-pad"
                          placeholder="e.g. 18"
                          placeholderTextColor={p.faint}
                        />
                      </View>
                      <View style={[styles.qtyCol, { flex: 2 }]}>
                        <Text style={styles.miniLabel}>Amount</Text>
                        <TextInput
                          style={[styles.input, styles.amountInput]}
                          value={line.amount}
                          onChangeText={(v) => updateLine(line.id, { amount: v })}
                          keyboardType="decimal-pad"
                          placeholderTextColor={p.faint}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Labour charges</Text>
                <Text style={styles.summaryValue}>{formatCurrency(String(chargeTotals.labour))}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Material charges</Text>
                <Text style={styles.summaryValue}>{formatCurrency(String(chargeTotals.material))}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tool charges</Text>
                <Text style={styles.summaryValue}>{formatCurrency(String(chargeTotals.tool))}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Other approved charges</Text>
                <Text style={styles.summaryValue}>{formatCurrency(String(chargeTotals.other))}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{gstAmount > 0 ? `GST (${effectiveGstPercent}%)` : "GST"}</Text>
                <Text style={styles.summaryValue}>{gstAmount > 0 ? formatCurrency(String(gstAmount)) : "—"}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Total</Text>
                <Text style={styles.summaryTotalValue}>{formatCurrency(String(invoiceTotal))}</Text>
              </View>
              <Text style={styles.summaryHint}>
                {completed
                  ? "Creates the final invoice. The project is marked completed when all its invoices are paid."
                  : "Creates a progress invoice and keeps the project active."}
              </Text>
              {billableExpenses.length > 0 ? (
                <Text style={styles.summaryHint}>
                  Includes {billableExpenses.length} billable expense{billableExpenses.length === 1 ? "" : "s"}.
                </Text>
              ) : null}
              <Pressable style={styles.btn} onPress={submit} disabled={create.isPending || !lines.length}>
                {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create invoice</Text>}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  err: { color: p.red, marginBottom: spacing.md },
  attendWarn: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attendWarnTitle: { color: p.clayDark, fontWeight: "800", fontSize: 14 },
  attendWarnBody: { color: p.muted, marginTop: 6, lineHeight: 18, fontSize: 13 },
  attendWarnLink: { color: p.clay, fontWeight: "700", marginTop: 10 },
  totalHero: {
    backgroundColor: "#fff7ed",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "#fdba74",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  totalHeroLabel: { color: p.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  totalHeroAmt: { color: p.clay, fontSize: 28, fontWeight: "800", marginTop: 4 },
  totalHeroMeta: { color: p.muted, fontSize: 12, marginTop: 6 },
  sectionCard: {
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: p.text, fontWeight: "800", fontSize: 15, marginBottom: 4 },
  linesHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  hint: { color: p.muted, fontSize: 12, marginBottom: 8 },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  miniLabel: { color: p.faint, fontWeight: "600", fontSize: 11, marginBottom: 4 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: p.text,
  },
  multi: { minHeight: 80, textAlignVertical: "top" },
  amountInput: { fontWeight: "700" },
  toggle: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.lg,
    padding: 12,
    backgroundColor: p.background,
  },
  toggleOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  toggleText: { color: p.muted, fontWeight: "600", fontSize: 13 },
  toggleTextOn: { color: p.clayDark },
  actionRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  actionBtn: {
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionBtnGhost: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: p.background,
  },
  actionBtnGhostText: { color: p.text, fontWeight: "700", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.background,
  },
  chipText: { color: p.muted, fontWeight: "600", fontSize: 12 },
  lineCard: {
    borderTopWidth: 1,
    borderTopColor: p.border,
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  lineHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  lineBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  lineBadgeText: { color: p.clayDark, fontWeight: "800", fontSize: 11 },
  lineSource: { flex: 1, color: p.faint, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  remove: { color: p.red, fontWeight: "700", fontSize: 12 },
  qtyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  qtyCol: { width: "47%", flexGrow: 1 },
  summaryCard: {
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  summaryLabel: { color: p.muted, fontSize: 14 },
  summaryValue: { color: p.text, fontWeight: "600" },
  summaryTotal: { borderTopWidth: 1, borderTopColor: p.border, paddingTop: 12, marginTop: 12 },
  summaryTotalLabel: { color: p.text, fontWeight: "800", fontSize: 15 },
  summaryTotalValue: { color: p.clay, fontWeight: "800", fontSize: 18 },
  summaryHint: { color: p.faint, fontSize: 12, marginTop: 10, lineHeight: 17 },
  btn: {
    marginTop: spacing.md,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
