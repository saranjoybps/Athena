import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useSites } from "@/hooks/useApi";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export type ToolValues = { name: string; qty: string; storage: string; siteId: string };
type Errors = Partial<Record<keyof ToolValues, string>>;

const EMPTY: ToolValues = { name: "", qty: "1", storage: "", siteId: "" };

/** Older tools were saved with the placeholder store name "main". */
export function storageLabel(warehouse: unknown): string {
  const value = String(warehouse || "").trim();
  return !value || value.toLowerCase() === "main" ? "Main store" : value;
}

export function toolValuesFrom(data: AthenaRecord): ToolValues {
  return {
    name: String(data.name || ""),
    qty: data.qty == null ? "0" : String(data.qty),
    storage: storageLabel(data.warehouse),
    siteId: String(data.siteId || ""),
  };
}

export function toolBody(v: ToolValues): Record<string, unknown> {
  return {
    name: v.name.trim(),
    qty: String(Number(v.qty.trim())),
    warehouse: v.storage.trim() || "Main store",
    siteId: v.siteId || null,
  };
}

function validate(v: ToolValues, mode: "create" | "edit"): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "Enter the tool name";
  const qty = Number(v.qty.trim());
  if (!v.qty.trim()) errors.qty = "Enter the quantity";
  else if (!Number.isInteger(qty) || qty < 0) errors.qty = "Enter a whole number";
  else if (mode === "create" && qty < 1) errors.qty = "Quantity must be at least 1";
  return errors;
}

type Props = {
  mode: "create" | "edit";
  initial?: ToolValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onSubmit: (values: ToolValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function ToolFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "Add tool" : "Edit tool"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <ToolFields {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function ToolFields({ mode, initial, saving, deleting, onSubmit, onDelete }: Props) {
  const sitesQ = useSites();
  const [values, setValues] = useState<ToolValues>(initial ?? EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(values, mode) : {};
  const busy = saving || Boolean(deleting);

  const siteOptions = useMemo(() => {
    const options = (sitesQ.data?.items ?? []).map((s) => ({
      id: String(s.id),
      label: String(s.name || "Unnamed site"),
      detail: String(s.address || s.city || "").trim() || undefined,
    }));
    if (values.siteId && !options.some((o) => o.id === values.siteId)) {
      options.unshift({ id: values.siteId, label: "Unavailable site", detail: undefined });
    }
    return options;
  }, [sitesQ.data?.items, values.siteId]);

  function set<K extends keyof ToolValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values, mode)).length > 0) return;
    await onSubmit(values);
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(values.name.trim() ? `Delete tool "${values.name.trim()}"?` : "Delete tool?", "This tool will be removed from your tools list permanently.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete tool", style: "destructive", onPress: () => void onDelete() },
    ]);
  }

  return (
    <View>
      <View style={styles.card}>
        <FormField
          label="Tool name"
          required
          value={values.name}
          onChangeText={(v) => set("name", v)}
          error={errors.name}
          autoCapitalize="words"
          placeholder="e.g. Aluminium ladder"
        />
        <FormField
          label="Quantity"
          required
          value={values.qty}
          onChangeText={(v) => set("qty", v.replace(/\D/g, ""))}
          error={errors.qty}
          keyboardType="number-pad"
          maxLength={6}
        />
        <FormField
          label="Storage location"
          value={values.storage}
          onChangeText={(v) => set("storage", v)}
          autoCapitalize="words"
          placeholder="Main store"
        />
        <FormField label="Assigned site">
          {sitesQ.isError ? (
            <ErrorBanner
              message={(sitesQ.error as { userMessage?: string })?.userMessage || "Couldn't load sites."}
              onRetry={() => sitesQ.refetch()}
            />
          ) : (
            <SelectDropdown
              options={siteOptions}
              value={values.siteId}
              onChange={(v) => set("siteId", v)}
              placeholder={sitesQ.isLoading ? "Loading sites…" : "Not assigned"}
              clearLabel="Not assigned (in storage)"
              searchPlaceholder="Search sites"
              emptyText="No sites yet. Sites are added from a customer's profile."
            />
          )}
        </FormField>
      </View>

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{mode === "create" ? "Add tool" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[styles.danger, busy && styles.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={styles.dangerText}>Delete tool</Text>
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
