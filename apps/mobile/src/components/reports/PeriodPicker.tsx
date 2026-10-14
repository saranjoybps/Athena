import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react-native";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import {
  fyOptions,
  isCurrentOrFuture,
  isOldest,
  monthOptions,
  stepPeriod,
  switchMode,
  yearOptions,
  type ReportMode,
  type ReportPeriod,
} from "@/lib/reportPeriod";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

const MODES: { key: ReportMode; label: string; icon: typeof CalendarDays }[] = [
  { key: "month", label: "Monthly", icon: CalendarDays },
  { key: "year", label: "Annual", icon: CalendarRange },
];

type Props = { value: ReportPeriod; onChange: (period: ReportPeriod) => void };

export function PeriodPicker({ value, onChange }: Props) {
  const canNext = !isCurrentOrFuture(value);
  const canPrev = !isOldest(value);

  function setYear(year: number) {
    const months = monthOptions(year);
    const month = Math.min(value.month, months.length);
    onChange({ ...value, year, month });
  }

  return (
    <View style={styles.card}>
      <View style={styles.toggle}>
        {MODES.map(({ key, label, icon: Icon }) => {
          const on = value.mode === key;
          return (
            <Pressable
              key={key}
              style={[styles.toggleItem, on && styles.toggleOn]}
              onPress={() => onChange(switchMode(value, key))}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Icon size={16} color={on ? p.clayDark : p.muted} strokeWidth={2.4} />
              <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.step, !canPrev && styles.stepDisabled]}
          onPress={() => onChange(stepPeriod(value, -1))}
          disabled={!canPrev}
          hitSlop={6}
          accessibilityLabel="Previous period"
        >
          <ChevronLeft size={20} color={canPrev ? p.text : p.faint} />
        </Pressable>

        {value.mode === "month" ? (
          <>
            <View style={styles.monthBox}>
              <SelectDropdown
                options={monthOptions(value.year)}
                value={String(value.month)}
                onChange={(id) => onChange({ ...value, month: Number(id) })}
                placeholder="Month"
              />
            </View>
            <View style={styles.yearBox}>
              <SelectDropdown
                options={yearOptions()}
                value={String(value.year)}
                onChange={(id) => setYear(Number(id))}
                placeholder="Year"
              />
            </View>
          </>
        ) : (
          <View style={styles.fyBox}>
            <SelectDropdown
              options={fyOptions()}
              value={String(value.year)}
              onChange={(id) => onChange({ ...value, year: Number(id) })}
              placeholder="Financial year"
            />
          </View>
        )}

        <Pressable
          style={[styles.step, !canNext && styles.stepDisabled]}
          onPress={() => onChange(stepPeriod(value, 1))}
          disabled={!canNext}
          hitSlop={6}
          accessibilityLabel="Next period"
        >
          <ChevronRight size={20} color={canNext ? p.text : p.faint} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    gap: 12,
    ...softShadow,
  },
  toggle: { flexDirection: "row", backgroundColor: p.slateSoft, borderRadius: radius.full, padding: 4 },
  toggleItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.full,
  },
  toggleOn: { backgroundColor: p.surface, ...softShadow },
  toggleText: { color: p.muted, fontWeight: "700", fontSize: 14 },
  toggleTextOn: { color: p.clayDark },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  step: {
    width: 40,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: p.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
  },
  stepDisabled: { backgroundColor: p.slateSoft, borderColor: p.border },
  monthBox: { flex: 1.2 },
  yearBox: { flex: 1, minWidth: 104 },
  fyBox: { flex: 1 },
});
