import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export type WorkerValues = { name: string; phone: string; trade: string; dailyRate: string };
type Errors = Partial<Record<keyof WorkerValues, string>>;

const TRADES = ["Painter", "Helper", "Mason", "Carpenter", "Electrician", "Plumber"];
const EMPTY: WorkerValues = { name: "", phone: "", trade: "", dailyRate: "" };

function validate(v: WorkerValues): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "Enter the worker's name";
  const digits = v.phone.replace(/\D/g, "");
  if (!v.phone.trim()) errors.phone = "Enter a phone number";
  else if (digits.length < 10 || digits.length > 13) errors.phone = "Enter a valid 10-digit phone number";
  if (!v.trade.trim()) errors.trade = "Enter the worker's trade";
  const rate = Number(v.dailyRate.trim());
  if (!v.dailyRate.trim()) errors.dailyRate = "Enter the daily rate";
  else if (!Number.isFinite(rate) || rate <= 0) errors.dailyRate = "Enter a valid amount";
  return errors;
}

type Props = {
  mode: "create" | "edit";
  initial?: WorkerValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onSubmit: (values: WorkerValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function WorkerFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "Add worker" : "Edit worker"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <WorkerFields {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function WorkerFields({ mode, initial, saving, deleting, onSubmit, onDelete }: Props) {
  const [values, setValues] = useState<WorkerValues>(initial ?? EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(values) : {};
  const busy = saving || Boolean(deleting);

  function set<K extends keyof WorkerValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    await onSubmit({
      name: values.name.trim(),
      phone: values.phone.trim(),
      trade: values.trade.trim(),
      dailyRate: values.dailyRate.trim(),
    });
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(values.name.trim() ? `Delete worker "${values.name.trim()}"?` : "Delete worker?", "This worker will be removed from your team permanently.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete worker", style: "destructive", onPress: () => void onDelete() },
    ]);
  }

  return (
    <View>
      <View style={styles.card}>
        <FormField
          label="Name"
          required
          value={values.name}
          onChangeText={(v) => set("name", v)}
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <FormField
          label="Phone number"
          required
          value={values.phone}
          onChangeText={(v) => set("phone", v)}
          error={errors.phone}
          keyboardType="phone-pad"
          maxLength={16}
        />
        <FormField
          label="Trade"
          required
          value={values.trade}
          onChangeText={(v) => set("trade", v)}
          error={errors.trade}
          autoCapitalize="words"
        />
        <View style={styles.trades}>
          {TRADES.map((t) => {
            const on = values.trade.trim().toLowerCase() === t.toLowerCase();
            return (
              <Pressable key={t} onPress={() => set("trade", t)} style={[styles.trade, on && styles.tradeOn]}>
                <Text style={[styles.tradeText, on && styles.tradeTextOn]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        <FormField
          label="Daily rate (₹)"
          required
          value={values.dailyRate}
          onChangeText={(v) => set("dailyRate", v.replace(/[^\d.]/g, ""))}
          error={errors.dailyRate}
          keyboardType="decimal-pad"
        />
      </View>

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{mode === "create" ? "Add worker" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[styles.danger, busy && styles.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={styles.dangerText}>Delete worker</Text>
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
  trades: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -6, marginBottom: 16 },
  trade: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.borderStrong,
    backgroundColor: p.surface,
  },
  tradeOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  tradeText: { color: p.muted, fontSize: 13, fontWeight: "600" },
  tradeTextOn: { color: p.clayDark },
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
