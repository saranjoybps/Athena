import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { formStyles as f } from "@/components/ui/formStyles";
import { useProject, useProjectProfitability, useProjectSchedules } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  OTHER_CATEGORY,
  PAID_BY,
  budgetLineOptions,
  budgetLinesOf,
  categoryForKind,
  isPresetCategory,
} from "@/lib/projects";
import { lightPalette as p } from "@/lib/theme";

export type ExpenseValues = {
  category: string;
  customCategory: string;
  amount: string;
  paidBy: string;
  description: string;
  billableToCustomer: boolean;
  budgetLineId: string;
};

export const emptyExpense: ExpenseValues = {
  category: "",
  customCategory: "",
  amount: "",
  paidBy: "cash",
  description: "",
  billableToCustomer: false,
  budgetLineId: "",
};

export function expenseValuesFrom(e: Record<string, unknown>): ExpenseValues {
  const raw = String(e.category || "").trim();
  const preset = isPresetCategory(raw);
  return {
    category: preset ? raw.toLowerCase() : raw ? OTHER_CATEGORY : "",
    customCategory: preset || raw.toLowerCase() === OTHER_CATEGORY ? "" : raw,
    amount: String(e.amount || ""),
    paidBy: String(e.paidBy || "cash"),
    description: String(e.description || ""),
    billableToCustomer: Boolean(e.billableToCustomer),
    budgetLineId: String(e.budgetLineId || ""),
  };
}

export function expenseBody(v: ExpenseValues) {
  return {
    category: v.category === OTHER_CATEGORY ? v.customCategory.trim() : v.category,
    amount: v.amount.trim(),
    paidBy: v.paidBy || "cash",
    description: v.description.trim() || null,
    billableToCustomer: v.billableToCustomer,
    budgetLineId: v.budgetLineId || null,
  };
}

type Errors = Partial<Record<keyof ExpenseValues, string>>;

function validate(v: ExpenseValues, crewScheduled: boolean, wasLabour: boolean): Errors {
  const e: Errors = {};
  if (!v.category) e.category = "Choose what the money was spent on";
  else if (v.category === "labour" && crewScheduled && !wasLabour) e.category = "Labour comes from attendance on this project";
  if (v.category === OTHER_CATEGORY && !v.customCategory.trim()) e.customCategory = "Type what it was for, e.g. Water cans";
  const amount = Number(v.amount);
  if (!v.amount.trim() || !Number.isFinite(amount) || amount <= 0) e.amount = "Enter the amount spent";
  return e;
}

type Props = {
  mode: "create" | "edit";
  projectId: string;
  initial: ExpenseValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onSubmit: (values: ExpenseValues) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onBack: () => void;
};

export function ExpenseFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={f.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={f.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader title={mode === "create" ? "Log expense" : "Expense"} subtitle="Booked against the project budget" onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {initial ? <ExpenseFields {...props} initial={initial} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function ExpenseFields({ mode, projectId, initial, saving, deleting, onSubmit, onDelete }: Props & { initial: ExpenseValues }) {
  const [values, setValues] = useState<ExpenseValues>(initial);
  const [submitted, setSubmitted] = useState(false);
  const projectQ = useProject(projectId || undefined);
  const profitQ = useProjectProfitability(projectId || undefined);
  const schedulesQ = useProjectSchedules(projectId || undefined);
  const project = projectQ.data;
  const crewScheduled = (schedulesQ.data?.items ?? []).length > 0;
  const wasLabour = initial.category === "labour";
  const errors = submitted ? validate(values, crewScheduled, wasLabour) : {};
  const busy = saving || Boolean(deleting);

  const lines = useMemo(() => {
    const spent = budgetLinesOf(profitQ.data);
    return spent.length ? spent : budgetLinesOf(project);
  }, [profitQ.data, project]);
  const line = lines.find((l) => l.id === values.budgetLineId);

  const categories = useMemo(
    () => (crewScheduled && !wasLabour ? EXPENSE_CATEGORIES.filter((c) => c.id !== "labour") : EXPENSE_CATEGORIES),
    [crewScheduled, wasLabour],
  );

  function set<K extends keyof ExpenseValues>(key: K, value: ExpenseValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function pickLine(id: string) {
    const picked = lines.find((l) => l.id === id);
    setValues((prev) => ({ ...prev, budgetLineId: id, category: picked ? categoryForKind(picked.kind, crewScheduled) : prev.category }));
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values, crewScheduled, wasLabour)).length) return;
    await onSubmit(values);
  }

  function confirmDelete() {
    if (!onDelete) return;
    const label = values.category === OTHER_CATEGORY ? values.customCategory : EXPENSE_CATEGORIES.find((c) => c.id === values.category)?.label;
    Alert.alert(
      `Delete expense of ${formatCurrency(values.amount || "0")}?`,
      `${label ? `${label} · ` : ""}It will be removed from this project's spend and profit.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete expense", style: "destructive", onPress: () => void onDelete() },
      ],
    );
  }

  return (
    <View>
      <View style={f.card}>
        <Text style={f.cardTitle}>Project</Text>
        <Text style={f.cardHint}>Expenses reduce this project's profit and show up in its budget.</Text>
        <View style={[f.readonly, { marginBottom: 16 }]}>
          <Text style={f.readonlyText}>{project ? String(project.name || project.number || "Project") : projectId ? "Loading…" : "No project selected"}</Text>
          {project ? (
            <Text style={f.readonlyDetail}>
              {[project.number, project.contractValue ? `Contract ${formatCurrency(String(project.contractValue))}` : ""].filter(Boolean).map(String).join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={f.card}>
        <Text style={f.cardTitle}>What was it for?</Text>
        <Text style={f.cardHint}>Snacks, transport, small purchases and other site spends.</Text>
        <FormField label="Category" required error={errors.category}>
          <SelectDropdown options={categories} value={values.category} onChange={(v) => set("category", v)} placeholder="Choose a category" error={errors.category} />
          {values.category === "labour" && !crewScheduled ? (
            <Text style={styles.hint}>No crew is scheduled, so labour is entered here. Scheduling a crew later is blocked while labour entries exist.</Text>
          ) : null}
        </FormField>
        {values.category === OTHER_CATEGORY ? (
          <FormField
            label="Category name"
            required
            value={values.customCategory}
            onChangeText={(v) => set("customCategory", v)}
            placeholder="e.g. Water cans, Site cleaning"
            error={errors.customCategory}
            maxLength={60}
            autoCapitalize="sentences"
          />
        ) : null}
        {crewScheduled ? (
          <View style={[f.warn, { marginBottom: 16 }]}>
            <Text style={f.warnText}>A crew is scheduled on this project, so labour cost comes from attendance, not from expenses.</Text>
          </View>
        ) : null}
        <FormField
          label="Amount (₹)"
          required
          value={values.amount}
          onChangeText={(v) => set("amount", v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
          keyboardType="decimal-pad"
          placeholder="0"
          error={errors.amount}
        />
        <FormField label="Paid via">
          <SelectDropdown options={PAID_BY} value={values.paidBy} onChange={(v) => set("paidBy", v || "cash")} placeholder="How was it paid?" />
        </FormField>
        {lines.length ? (
          <FormField label="Against estimate line (optional)">
            <SelectDropdown
              options={budgetLineOptions(lines)}
              value={values.budgetLineId}
              onChange={pickLine}
              placeholder="General site expense"
              clearLabel="General site expense (not a specific line)"
              searchPlaceholder="Search estimate lines"
            />
            {line ? (
              <Text style={styles.lineHint}>
                Quoted {formatCurrency(line.amount)}
                {line.spent && Number(line.spent) > 0 ? ` · already spent ${formatCurrency(line.spent)}` : ""}
              </Text>
            ) : null}
          </FormField>
        ) : null}
        <FormField label="Notes" value={values.description} onChangeText={(v) => set("description", v)} multiline placeholder="e.g. Tea and snacks for 6 workers" />
        <Pressable
          style={styles.checkRow}
          onPress={() => set("billableToCustomer", !values.billableToCustomer)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: values.billableToCustomer }}
        >
          <View style={[styles.checkbox, values.billableToCustomer && styles.checkboxOn]}>
            {values.billableToCustomer ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkLabel}>Charge this to the customer</Text>
            <Text style={styles.checkHint}>Adds it as a line on the next invoice (for extras outside the estimate).</Text>
          </View>
        </Pressable>
      </View>

      <Pressable style={[f.primary, busy && f.disabled]} onPress={submit} disabled={busy || !projectId}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={f.primaryText}>{mode === "create" ? "Save expense" : "Save changes"}</Text>}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[f.danger, busy && f.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={f.dangerText}>Delete expense</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: p.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  lineHint: { color: p.clayDark, fontSize: 12, fontWeight: "700", marginTop: 6 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: p.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: p.clay, borderColor: p.clay },
  checkLabel: { color: p.text, fontWeight: "700", fontSize: 14 },
  checkHint: { color: p.muted, fontSize: 12, marginTop: 2 },
});
