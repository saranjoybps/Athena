import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export type PaymentValues = { invoiceId: string; amount: string; method: PaymentMethod; reference: string; notes: string };
type Errors = Partial<Record<keyof PaymentValues, string>>;

type Props = {
  mode: "create" | "edit";
  initial?: PaymentValues | null;
  /** Open invoices to choose from (create mode without a fixed invoice). */
  invoices: AthenaRecord[];
  invoicesLoading?: boolean;
  /** Fixed invoice: from the invoice screen, or the payment being edited. */
  lockedInvoice?: AthenaRecord | null;
  /** Amount already on this payment (edit mode) — it can be re-allocated on top of the open balance. */
  originalAmount?: number;
  customerName?: (invoice: AthenaRecord) => string;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onSubmit: (values: PaymentValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function PaymentFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "Record payment" : "Edit payment"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {!loading && (mode === "create" || initial) ? <PaymentFields key={initial?.invoiceId ?? "new"} {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function outstandingOf(inv?: AthenaRecord | null) {
  return Number(inv?.outstanding ?? inv?.total ?? 0) || 0;
}

function PaymentFields({
  mode,
  initial,
  invoices,
  invoicesLoading,
  lockedInvoice,
  originalAmount = 0,
  customerName,
  saving,
  deleting,
  onSubmit,
  onDelete,
}: Props) {
  const [values, setValues] = useState<PaymentValues>(
    initial ?? {
      invoiceId: lockedInvoice ? String(lockedInvoice.id) : "",
      amount: lockedInvoice ? String(outstandingOf(lockedInvoice) || "") : "",
      method: "upi",
      reference: "",
      notes: "",
    },
  );
  const [submitted, setSubmitted] = useState(false);
  const busy = saving || Boolean(deleting);

  const invoice = lockedInvoice ?? invoices.find((i) => String(i.id) === values.invoiceId) ?? null;
  const maxAmount = outstandingOf(invoice) + (mode === "edit" ? originalAmount : 0);

  const invoiceOptions = useMemo(
    () =>
      invoices.map((inv) => ({
        id: String(inv.id),
        label: `${String(inv.number || "Invoice")} · ${formatCurrency(outstandingOf(inv))} due`,
        detail: customerName?.(inv) || undefined,
      })),
    [invoices, customerName],
  );

  function validate(v: PaymentValues): Errors {
    const errors: Errors = {};
    if (!v.invoiceId) errors.invoiceId = "Pick the invoice being paid";
    const amount = Number(v.amount);
    if (!v.amount.trim()) errors.amount = "Enter the amount received";
    else if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Enter a valid amount";
    else if (invoice && amount > maxAmount + 0.001) errors.amount = `Can't be more than ${formatCurrency(maxAmount)}`;
    return errors;
  }

  const errors = submitted ? validate(values) : {};

  function set<K extends keyof PaymentValues>(key: K, value: PaymentValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function pickInvoice(id: string) {
    const inv = invoices.find((i) => String(i.id) === id);
    setValues((prev) => ({ ...prev, invoiceId: id, amount: inv ? String(outstandingOf(inv)) : prev.amount }));
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    await onSubmit({ ...values, amount: values.amount.trim(), reference: values.reference.trim(), notes: values.notes.trim() });
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(
      `Delete payment of ${formatCurrency(values.amount)}?`,
      `This payment will be permanently deleted and the amount added back to ${invoice?.number ? `invoice ${String(invoice.number)}` : "the invoice"}'s balance. If this payment completed the project, it moves back to its previous status.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete payment", style: "destructive", onPress: () => void onDelete() },
      ],
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <FormField label="Invoice" required error={errors.invoiceId}>
          {lockedInvoice ? (
            <View style={styles.invoiceBox}>
              <View style={styles.invoiceIcon}>
                <FileText size={18} color={p.clayDark} strokeWidth={2.3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.invoiceTitle} numberOfLines={1}>
                  {String(lockedInvoice.number || "Invoice")}
                  {customerName ? ` · ${customerName(lockedInvoice)}` : ""}
                </Text>
                <Text style={styles.invoiceSub}>
                  {formatCurrency(outstandingOf(lockedInvoice))} due of {formatCurrency(Number(lockedInvoice.total || 0))}
                </Text>
              </View>
            </View>
          ) : (
            <SelectDropdown
              options={invoiceOptions}
              value={values.invoiceId}
              onChange={pickInvoice}
              placeholder={invoicesLoading ? "Loading invoices…" : "Select an invoice"}
              error={errors.invoiceId}
              searchPlaceholder="Search invoices or customers"
              emptyText="No invoices with a balance due."
            />
          )}
        </FormField>

        <FormField
          label="Amount received (₹)"
          required
          value={values.amount}
          onChangeText={(v) => set("amount", v.replace(/[^\d.]/g, ""))}
          error={errors.amount}
          keyboardType="decimal-pad"
          placeholder={invoice ? String(maxAmount) : "0"}
        />
        {invoice && maxAmount > 0 && Number(values.amount) !== maxAmount ? (
          <Pressable style={styles.fullBtn} onPress={() => set("amount", String(maxAmount))}>
            <Text style={styles.fullBtnText}>Use full balance · {formatCurrency(maxAmount)}</Text>
          </Pressable>
        ) : null}

        <FormField label="Payment method" required>
          <View style={styles.methods}>
            {PAYMENT_METHODS.map((m) => {
              const on = values.method === m.id;
              const Icon = m.icon;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.method, on && styles.methodOn]}
                  onPress={() => set("method", m.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Icon size={16} color={on ? p.clayDark : p.muted} strokeWidth={2.3} />
                  <Text style={[styles.methodText, on && styles.methodTextOn]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </FormField>

        <FormField
          label="Reference"
          value={values.reference}
          onChangeText={(v) => set("reference", v)}
          placeholder="UPI ref, cheque no. or bank txn id"
          autoCapitalize="characters"
        />
        <FormField
          label="Notes"
          value={values.notes}
          onChangeText={(v) => set("notes", v)}
          placeholder="Optional"
          multiline
        />
      </View>

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{mode === "create" ? "Record payment" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[styles.danger, busy && styles.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={styles.dangerText}>Delete payment</Text>
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
  invoiceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: p.claySoft,
    borderWidth: 1,
    borderColor: p.clayMid,
  },
  invoiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: p.clayMid,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceTitle: { color: p.text, fontWeight: "700", fontSize: 15 },
  invoiceSub: { color: p.muted, fontSize: 13, marginTop: 2 },
  fullBtn: {
    alignSelf: "flex-start",
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: p.greenSoft,
  },
  fullBtnText: { color: p.green, fontWeight: "700", fontSize: 13 },
  methods: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.borderStrong,
    backgroundColor: p.surface,
  },
  methodOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  methodText: { color: p.muted, fontSize: 13, fontWeight: "600" },
  methodTextOn: { color: p.clayDark },
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
