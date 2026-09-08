import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  MEASUREMENT_TYPES,
  MeasurementItem,
  MeasurementType,
  createMeasurementItem,
  fieldsForType,
  primaryQuantity,
  recomputeItem,
  typeLabel,
} from "@/lib/measurements";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export function MeasurementEditor({
  items,
  onChange,
}: {
  items: MeasurementItem[];
  onChange: (items: MeasurementItem[]) => void;
}) {
  function addItem(type: MeasurementType = "area") {
    onChange([...items, createMeasurementItem(type)]);
  }

  function updateItem(id: string, patch: Partial<MeasurementItem>) {
    onChange(items.map((item) => (item.id === id ? recomputeItem({ ...item, ...patch }) : item)));
  }

  function updateValue(id: string, key: string, value: string) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        return recomputeItem({ ...item, values: { ...item.values, [key]: value } });
      }),
    );
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  const total = items.reduce((sum, item) => sum + primaryQuantity(item.outputs), 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.typeRow}>
        {MEASUREMENT_TYPES.map((t) => (
          <Pressable key={t.value} style={styles.typeChip} onPress={() => addItem(t.value)}>
            <Text style={styles.typeText}>+ {t.label}</Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? <Text style={styles.empty}>Add walls, rooms, openings, or area lines.</Text> : null}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{item.label || typeLabel(item.type)}</Text>
            <Pressable onPress={() => removeItem(item.id)}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Label</Text>
          <TextInput
            style={styles.input}
            value={item.label}
            onChangeText={(label) => updateItem(item.id, { label })}
            placeholderTextColor={p.faint}
          />
          {fieldsForType(item.type).map((field) => (
            <View key={field.key}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={item.values[field.key] || ""}
                onChangeText={(v) => updateValue(item.id, field.key, v)}
                keyboardType={field.type === "number" ? "decimal-pad" : "default"}
                placeholderTextColor={p.faint}
              />
            </View>
          ))}
          <Text style={styles.qty}>
            ≈ {primaryQuantity(item.outputs)} {String(item.outputs.unit || "sqft")}
          </Text>
        </View>
      ))}

      {items.length > 0 ? <Text style={styles.total}>Total ≈ {total} sqft</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: p.surface,
  },
  typeText: { color: p.muted, fontSize: 12, fontWeight: "600" },
  empty: { color: p.muted },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 6,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: p.text, fontWeight: "700", flex: 1 },
  remove: { color: p.clay, fontWeight: "700", fontSize: 13 },
  label: { color: p.muted, fontWeight: "600", marginTop: 6, fontSize: 12 },
  input: {
    backgroundColor: p.background,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: p.text,
  },
  qty: { color: p.clay, fontWeight: "700", marginTop: 8 },
  total: { color: p.text, fontWeight: "700", fontSize: 16 },
});
