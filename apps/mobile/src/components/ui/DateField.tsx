import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { lightPalette as p, radius } from "@/lib/theme";

export function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIso(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Date-only picker; value is YYYY-MM-DD. Omit `label` when wrapping it in a `FormField`. */
export function DateField({
  label,
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function onPick(_event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (selected) onChange(formatIso(selected));
  }

  const display = value
    ? parseIso(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "Select date";

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.input, error ? styles.inputError : null]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}, ${display}` : display}
      >
        <Text style={[styles.value, !value && { color: p.faint }]}>{display}</Text>
        <CalendarDays size={18} color={p.muted} strokeWidth={2.2} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={parseIso(value || todayIsoDate())}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onPick}
        />
      ) : null}
      {Platform.OS === "ios" && open ? (
        <Pressable style={styles.done} onPress={() => setOpen(false)}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputError: { borderColor: p.red, backgroundColor: "#FFFBFB" },
  value: { color: p.text, fontSize: 15 },
  done: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 4 },
  doneText: { color: p.clay, fontWeight: "700" },
});
