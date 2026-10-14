import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown, type SelectOption } from "@/components/ui/SelectDropdown";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow, tabBarClearance } from "@/lib/theme";

export type MaterialValues = {
  name: string;
  category: string;
  brand: string;
  unit: string;
  purchasePrice: string;
  sellingPrice: string;
  gstRate: string;
  hsn: string;
  minimumStock: string;
};
type Errors = Partial<Record<keyof MaterialValues, string>>;

export const MATERIAL_CATEGORIES: SelectOption[] = [
  { id: "paint", label: "Paint" },
  { id: "primer", label: "Primer" },
  { id: "putty", label: "Putty" },
  { id: "prep", label: "Surface prep" },
  { id: "waterproofing", label: "Waterproofing" },
  { id: "consumables", label: "Consumables" },
  { id: "hardware", label: "Hardware" },
  { id: "plumbing", label: "Plumbing" },
  { id: "electrical", label: "Electrical" },
  { id: "other", label: "Other" },
];

const UNITS: SelectOption[] = [
  { id: "pcs", label: "Pieces (pcs)" },
  { id: "ltr", label: "Litre (ltr)" },
  { id: "kg", label: "Kilogram (kg)" },
  { id: "bag", label: "Bag" },
  { id: "box", label: "Box" },
  { id: "bucket", label: "Bucket" },
  { id: "roll", label: "Roll" },
  { id: "sqft", label: "Square feet (sqft)" },
  { id: "rft", label: "Running feet (rft)" },
  { id: "mtr", label: "Metre (mtr)" },
  { id: "set", label: "Set" },
];

const GST_RATES: SelectOption[] = [
  { id: "0", label: "0% (Exempt)" },
  { id: "0.05", label: "5%" },
  { id: "0.12", label: "12%" },
  { id: "0.18", label: "18%" },
  { id: "0.28", label: "28%" },
];

const EMPTY: MaterialValues = {
  name: "",
  category: "",
  brand: "",
  unit: "",
  purchasePrice: "",
  sellingPrice: "",
  gstRate: "0.18",
  hsn: "",
  minimumStock: "",
};

/** Material `gstRate` is a fraction (0.18); older rows may hold a percent. */
export function gstFraction(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || raw === null || raw === "") return 0.18;
  return n > 1 ? n / 100 : n;
}

export function categoryLabel(id: unknown): string {
  const key = String(id || "").trim();
  if (!key) return "";
  const known = MATERIAL_CATEGORIES.find((c) => c.id === key.toLowerCase());
  return known ? known.label : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

export function materialValuesFrom(data: AthenaRecord): MaterialValues {
  const text = (v: unknown) => (v == null ? "" : String(v));
  return {
    name: text(data.name),
    category:
      MATERIAL_CATEGORIES.find((c) => c.id === text(data.category).trim().toLowerCase())?.id ?? text(data.category),
    brand: text(data.brand),
    unit: UNITS.find((u) => u.id === text(data.unit).trim().toLowerCase())?.id ?? text(data.unit),
    purchasePrice: text(data.defaultPurchasePrice),
    sellingPrice: text(data.defaultSellingPrice),
    gstRate: String(Number(gstFraction(data.gstRate).toFixed(4))),
    hsn: text(data.hsn),
    minimumStock: text(data.minimumStock),
  };
}

export function materialBody(v: MaterialValues): Record<string, unknown> {
  return {
    name: v.name.trim(),
    category: v.category || null,
    brand: v.brand.trim() || null,
    unit: v.unit,
    defaultPurchasePrice: v.purchasePrice.trim() || null,
    defaultSellingPrice: v.sellingPrice.trim(),
    gstRate: Number(v.gstRate),
    hsn: v.hsn.trim() || null,
    minimumStock: v.minimumStock.trim() || null,
  };
}

function isAmount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function validate(v: MaterialValues): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "Enter the material name";
  if (!v.unit) errors.unit = "Select a unit";
  if (!v.sellingPrice.trim()) errors.sellingPrice = "Enter the selling price";
  else if (!isAmount(v.sellingPrice) || Number(v.sellingPrice) <= 0) errors.sellingPrice = "Enter a valid amount";
  if (v.purchasePrice.trim() && !isAmount(v.purchasePrice)) errors.purchasePrice = "Enter a valid amount";
  if (v.gstRate === "") errors.gstRate = "Select a GST rate";
  if (v.hsn.trim() && !/^\d{4,8}$/.test(v.hsn.trim())) errors.hsn = "HSN code must be 4 to 8 digits";
  if (v.minimumStock.trim() && !isAmount(v.minimumStock)) errors.minimumStock = "Enter a valid quantity";
  return errors;
}

/** Keeps a saved value selectable even when it isn't one of the preset options. */
function withCurrent(options: SelectOption[], value: string, label: (v: string) => string): SelectOption[] {
  if (!value || options.some((o) => o.id === value)) return options;
  return [{ id: value, label: label(value) }, ...options];
}

type Props = {
  mode: "create" | "edit";
  initial?: MaterialValues | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  saving: boolean;
  deleting?: boolean;
  onBack: () => void;
  onSubmit: (values: MaterialValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function MaterialFormScreen(props: Props) {
  const { mode, initial, loading, loadError, onRetry, onBack } = props;
  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={mode === "create" ? "Add material" : "Edit material"} onBack={onBack} />
          {loading ? <ActivityIndicator color={p.clay} style={{ marginTop: 24 }} /> : null}
          {loadError ? <ErrorBanner message={loadError} onRetry={onRetry} /> : null}
          {mode === "create" || initial ? <MaterialFields {...props} /> : null}
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function MaterialFields({ mode, initial, saving, deleting, onSubmit, onDelete }: Props) {
  const [values, setValues] = useState<MaterialValues>(initial ?? EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(values) : {};
  const busy = saving || Boolean(deleting);

  const categoryOptions = useMemo(
    () => withCurrent(MATERIAL_CATEGORIES, initial?.category || "", categoryLabel),
    [initial?.category],
  );
  const unitOptions = useMemo(() => withCurrent(UNITS, initial?.unit || "", (u) => u), [initial?.unit]);
  const gstOptions = useMemo(
    () => withCurrent(GST_RATES, initial?.gstRate || "", (r) => `${Number((Number(r) * 100).toFixed(2))}%`),
    [initial?.gstRate],
  );

  function set<K extends keyof MaterialValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const amount = (v: string) => v.replace(/[^\d.]/g, "");

  async function submit() {
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    await onSubmit(values);
  }

  function confirmDelete() {
    if (!onDelete) return;
    Alert.alert(values.name.trim() ? `Delete material "${values.name.trim()}"?` : "Delete material?", "This material will be removed from your catalog permanently.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete material", style: "destructive", onPress: () => void onDelete() },
    ]);
  }

  return (
    <View>
      <Text style={styles.section}>Details</Text>
      <View style={styles.card}>
        <FormField
          label="Material name"
          required
          value={values.name}
          onChangeText={(v) => set("name", v)}
          error={errors.name}
          autoCapitalize="words"
          placeholder="e.g. Tractor Emulsion"
        />
        <FormField label="Category">
          <SelectDropdown
            options={categoryOptions}
            value={values.category}
            onChange={(v) => set("category", v)}
            placeholder="Select category"
            clearLabel="No category"
          />
        </FormField>
        <FormField
          label="Brand"
          value={values.brand}
          onChangeText={(v) => set("brand", v)}
          autoCapitalize="words"
          placeholder="e.g. Asian Paints"
        />
        <FormField label="Unit" required error={errors.unit}>
          <SelectDropdown
            options={unitOptions}
            value={values.unit}
            onChange={(v) => set("unit", v)}
            placeholder="Select unit"
            error={errors.unit}
          />
        </FormField>
      </View>

      <Text style={styles.section}>Pricing & tax</Text>
      <View style={styles.card}>
        <FormField
          label="Selling price (₹)"
          required
          value={values.sellingPrice}
          onChangeText={(v) => set("sellingPrice", amount(v))}
          error={errors.sellingPrice}
          keyboardType="decimal-pad"
        />
        <FormField
          label="Purchase price (₹)"
          value={values.purchasePrice}
          onChangeText={(v) => set("purchasePrice", amount(v))}
          error={errors.purchasePrice}
          keyboardType="decimal-pad"
        />
        <FormField label="GST rate" required error={errors.gstRate}>
          <SelectDropdown
            options={gstOptions}
            value={values.gstRate}
            onChange={(v) => set("gstRate", v)}
            placeholder="Select GST rate"
            error={errors.gstRate}
          />
        </FormField>
        <FormField
          label="HSN code"
          value={values.hsn}
          onChangeText={(v) => set("hsn", v.replace(/\D/g, ""))}
          error={errors.hsn}
          keyboardType="number-pad"
          maxLength={8}
        />
        <FormField
          label="Minimum stock"
          value={values.minimumStock}
          onChangeText={(v) => set("minimumStock", amount(v))}
          error={errors.minimumStock}
          keyboardType="decimal-pad"
        />
      </View>

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{mode === "create" ? "Add material" : "Save changes"}</Text>
        )}
      </Pressable>

      {mode === "edit" && onDelete ? (
        <Pressable style={[styles.danger, busy && styles.disabled]} onPress={confirmDelete} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={p.red} />
          ) : (
            <>
              <Trash2 size={18} color={p.red} strokeWidth={2.4} />
              <Text style={styles.dangerText}>Delete material</Text>
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
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    paddingBottom: 0,
    marginBottom: spacing.md,
  },
  primary: {
    marginTop: spacing.sm,
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
