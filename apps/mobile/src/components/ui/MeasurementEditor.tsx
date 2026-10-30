import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Box, Clock, Copy, DoorOpen, Hash, Layers, Minus, Plus, Ruler, Square, SquareDashed, Trash2 } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import {
  CUSTOM_UNITS,
  DEDUCT_FROM,
  MEASUREMENT_TYPES,
  SURFACES,
  aggregateOutputs,
  createMeasurementItem,
  fieldsForType,
  formatQty,
  invalidItems,
  isSubtracted,
  itemResult,
  itemTitle,
  newItemId,
  recomputeItem,
  type MeasurementItem,
  type MeasurementType,
} from "@/lib/measurements";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

const ICONS: Record<MeasurementType, typeof Ruler> = {
  room: Box,
  wall: Square,
  ceiling: Layers,
  floor: SquareDashed,
  deduction: DoorOpen,
  running: Ruler,
  count: Hash,
  area: Square,
  pieces: Hash,
  length: Ruler,
  time: Clock,
  fixed: Box,
  custom: Plus,
};

export function MeasurementEditor({
  items,
  onChange,
  showErrors,
}: {
  items: MeasurementItem[];
  onChange: (items: MeasurementItem[]) => void;
  showErrors?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const totals = aggregateOutputs(items);
  const invalid = new Set(showErrors ? invalidItems(items).map((i) => i.id) : []);
  function add(type: MeasurementType) {
    onChange([...items, createMeasurementItem(type)]);
    setPicking(false);
  }

  function update(id: string, patch: Partial<MeasurementItem>) {
    onChange(items.map((item) => (item.id === id ? recomputeItem({ ...item, ...patch }) : item)));
  }

  function setValue(id: string, key: string, value: string) {
    onChange(items.map((item) => (item.id === id ? recomputeItem({ ...item, values: { ...item.values, [key]: value } }) : item)));
  }

  function duplicate(item: MeasurementItem) {
    const idx = items.findIndex((i) => i.id === item.id);
    const copy = recomputeItem({ ...item, id: newItemId(), label: item.label ? `${item.label} (copy)` : "" });
    onChange([...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]);
  }

  return (
    <View>
      <View style={styles.totals}>
        <Text style={styles.totalsLabel}>Quantities</Text>
        {totals.groups.length ? (
          <View style={styles.totalsGrid}>
            {totals.groups.map((g) => (
              <View key={g.key} style={styles.totalCell}>
                <Text style={styles.totalValue}>{formatQty(g.quantity)}</Text>
                <Text style={styles.totalUnit}>
                  {g.unit} · {g.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.totalsEmpty}>Add rooms or surfaces — totals appear here, grouped by surface.</Text>
        )}
        {totals.deductions > 0 ? <Text style={styles.deducted}>Subtracted: {formatQty(totals.deductions)} sqft</Text> : null}
      </View>

      {items.map((item, index) => {
        const Icon = ICONS[item.type] || Plus;
        const deduction = item.type === "deduction";
        const minus = isSubtracted(item);
        const bad = invalid.has(item.id);
        return (
          <View key={item.id} style={[styles.card, minus && styles.cardDeduct, bad && styles.cardError]}>
            <View style={styles.head}>
              <View style={[styles.badge, deduction && { backgroundColor: p.redSoft }]}>
                <Icon size={16} color={deduction ? p.red : p.clayDark} />
              </View>
              <TextInput
                style={styles.labelInput}
                value={item.label}
                onChangeText={(label) => update(item.id, { label })}
                placeholder={itemTitle({ ...item, label: "" }, index)}
                placeholderTextColor={p.faint}
                accessibilityLabel="Line name"
              />
              <Pressable onPress={() => duplicate(item)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Duplicate line">
                <Copy size={16} color={p.muted} />
              </Pressable>
              <Pressable onPress={() => onChange(items.filter((i) => i.id !== item.id))} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Remove line">
                <Trash2 size={16} color={p.red} />
              </Pressable>
            </View>

            <View style={styles.fields}>
              {fieldsForType(item.type).map((field) => {
                if (field.kind === "deductFrom") {
                  return (
                    <View key={field.key} style={styles.full}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <View style={styles.chips}>
                        {DEDUCT_FROM.map((o) => {
                          const on = (item.values.deductFrom || "walls") === o.id;
                          return (
                            <Pressable key={o.id} onPress={() => setValue(item.id, "deductFrom", o.id)} style={[styles.chip, on && styles.chipOn]}>
                              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                }
                if (field.kind === "unit") {
                  return (
                    <View key={field.key} style={styles.half}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <SelectDropdown options={CUSTOM_UNITS} value={item.values.unit || "sqft"} onChange={(v) => setValue(item.id, "unit", v || "sqft")} placeholder="Unit" />
                    </View>
                  );
                }
                if (field.kind === "surface") {
                  if ((item.values.unit || "sqft") !== "sqft") return null;
                  return (
                    <View key={field.key} style={styles.full}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <View style={styles.chips}>
                        {SURFACES.map((o) => {
                          const on = (item.values.surface || "otherArea") === o.id;
                          return (
                            <Pressable key={o.id} onPress={() => setValue(item.id, "surface", o.id)} style={[styles.chip, on && styles.chipOn]}>
                              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                }
                const value = item.values[field.key] || "";
                const missing = bad && field.required && !(Number(value) > 0);
                return (
                  <View key={field.key} style={field.key === "openings" ? styles.full : styles.third}>
                    <Text style={styles.fieldLabel} numberOfLines={1}>
                      {field.label}
                    </Text>
                    <View style={[styles.numBox, missing && styles.numBoxError]}>
                      <TextInput
                        style={styles.numInput}
                        value={value}
                        onChangeText={(v) => setValue(item.id, field.key, field.integer ? v.replace(/\D/g, "") : v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
                        keyboardType={field.integer ? "number-pad" : "decimal-pad"}
                        placeholder="0"
                        placeholderTextColor={p.faint}
                        accessibilityLabel={field.label}
                      />
                      {field.unit ? <Text style={styles.unit}>{field.unit}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.footRow}>
              <Text style={[styles.result, minus && { color: p.red }]}>{itemResult(item)}</Text>
              {deduction ? null : (
                <View style={styles.sign} accessibilityRole="radiogroup" accessibilityLabel="Add to or subtract from total">
                  <Pressable
                    onPress={() => update(item.id, { operation: "add" })}
                    style={[styles.signBtn, !minus && styles.signAdd]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !minus }}
                    accessibilityLabel="Add to total"
                  >
                    <Plus size={14} color={!minus ? "#fff" : p.muted} strokeWidth={3} />
                  </Pressable>
                  <Pressable
                    onPress={() => update(item.id, { operation: "subtract" })}
                    style={[styles.signBtn, minus && styles.signSub]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: minus }}
                    accessibilityLabel="Subtract from total"
                  >
                    <Minus size={14} color={minus ? "#fff" : p.muted} strokeWidth={3} />
                  </Pressable>
                </View>
              )}
            </View>
            {bad ? <Text style={styles.errText}>Enter the highlighted measurements</Text> : null}
          </View>
        );
      })}

      <Pressable style={styles.addBtn} onPress={() => setPicking(true)} accessibilityRole="button">
        <Plus size={18} color={p.clayDark} strokeWidth={2.6} />
        <Text style={styles.addText}>{items.length ? "Add another line" : "Add first line"}</Text>
      </Pressable>

      <BottomSheet visible={picking} onClose={() => setPicking(false)} title="Add a measurement" subtitle="All lengths in feet">
        <View style={styles.typeGrid}>
          {MEASUREMENT_TYPES.map((t) => {
            const Icon = ICONS[t.value];
            return (
              <Pressable key={t.value} style={styles.typeCard} onPress={() => add(t.value)} accessibilityRole="button">
                <View style={[styles.badge, t.value === "deduction" && { backgroundColor: p.redSoft }]}>
                  <Icon size={18} color={t.value === "deduction" ? p.red : p.clayDark} />
                </View>
                <Text style={styles.typeTitle}>{t.label}</Text>
                <Text style={styles.typeHint}>{t.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { backgroundColor: p.text, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12 },
  totalsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  totalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },
  totalCell: { minWidth: "28%" },
  totalValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
  totalUnit: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  totalsEmpty: { color: "rgba(255,255,255,0.8)", marginTop: 6, fontSize: 13 },
  deducted: { color: "#FCA5A5", fontSize: 12, fontWeight: "700", marginTop: 10 },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 10 },
  cardDeduct: { borderColor: "#FECACA" },
  cardError: { borderColor: p.red },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  badge: { width: 32, height: 32, borderRadius: 10, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  labelInput: { flex: 1, color: p.text, fontWeight: "700", fontSize: 15, paddingVertical: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: p.background },
  fields: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  third: { width: "33.33%", paddingHorizontal: 4, marginBottom: 8 },
  half: { width: "50%", paddingHorizontal: 4, marginBottom: 8 },
  full: { width: "100%", paddingHorizontal: 4, marginBottom: 8 },
  fieldLabel: { color: p.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  numBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: p.borderStrong, borderRadius: radius.sm, backgroundColor: p.surface, paddingHorizontal: 10 },
  numBoxError: { borderColor: p.red, backgroundColor: "#FFFBFB" },
  numInput: { flex: 1, paddingVertical: 10, color: p.text, fontSize: 15, fontWeight: "600" },
  unit: { color: p.faint, fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: p.borderStrong, backgroundColor: p.surface },
  chipOn: { backgroundColor: p.text, borderColor: p.text },
  chipText: { color: p.muted, fontWeight: "700", fontSize: 12 },
  chipTextOn: { color: "#fff" },
  footRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  result: { flex: 1, color: p.clayDark, fontWeight: "800", fontSize: 13 },
  sign: { flexDirection: "row", borderRadius: 999, borderWidth: 1, borderColor: p.borderStrong, overflow: "hidden" },
  signBtn: { width: 34, height: 28, alignItems: "center", justifyContent: "center", backgroundColor: p.surface },
  signAdd: { backgroundColor: p.green },
  signSub: { backgroundColor: p.red },
  errText: { color: p.red, fontSize: 12, fontWeight: "600", marginTop: 4 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  addText: { color: p.clayDark, fontWeight: "800" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "47.5%", backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 12, gap: 6 },
  typeTitle: { color: p.text, fontWeight: "800" },
  typeHint: { color: p.muted, fontSize: 12 },
});
