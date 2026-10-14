import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react-native";
import { fieldStyles } from "@/components/ui/FormField";
import { lightPalette as p, radius } from "@/lib/theme";

export type SelectOption = { id: string; label: string; detail?: string };

type Props = {
  options: SelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  error?: string;
  /** Adds a first row that clears the selection (e.g. "Not assigned"). */
  clearLabel?: string;
  /** Shows the trigger as a call-to-action and never keeps a selection (pick-to-add lists). */
  actionMode?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  emptyAction?: { label: string; onPress: () => void };
};

export function SelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  error,
  clearLabel,
  actionMode,
  searchPlaceholder,
  emptyText,
  emptyAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = actionMode ? undefined : options.find((o) => o.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.detail || "").toLowerCase().includes(q));
  }, [options, query]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[
          fieldStyles.input,
          styles.trigger,
          actionMode && styles.triggerAction,
          error ? fieldStyles.inputError : null,
          open && styles.triggerOpen,
        ]}
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.triggerBody}>
          <Text
            style={[styles.triggerText, !current && !actionMode && styles.placeholder, actionMode && styles.actionText]}
            numberOfLines={1}
          >
            {current ? current.label : placeholder}
          </Text>
          {current?.detail ? (
            <Text style={styles.triggerDetail} numberOfLines={1}>
              {current.detail}
            </Text>
          ) : null}
        </View>
        {open ? (
          <ChevronUp size={20} color={actionMode ? p.clayDark : p.muted} />
        ) : (
          <ChevronDown size={20} color={actionMode ? p.clayDark : p.muted} />
        )}
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {options.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyText || "Nothing to select yet."}</Text>
              {emptyAction ? (
                <Pressable onPress={emptyAction.onPress} hitSlop={6}>
                  <Text style={styles.link}>{emptyAction.label}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              {options.length > 6 ? (
                <View style={styles.searchRow}>
                  <Search size={16} color={p.faint} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={searchPlaceholder || "Search"}
                    placeholderTextColor={p.faint}
                    style={styles.searchInput}
                    autoCorrect={false}
                  />
                </View>
              ) : null}
              <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {clearLabel && !query.trim() ? (
                  <Pressable onPress={() => pick("")} style={[styles.option, !value && styles.optionOn]}>
                    <Text style={[styles.optionLabel, styles.clearLabel]}>{clearLabel}</Text>
                    {!value ? <Check size={16} color={p.clay} strokeWidth={3} /> : null}
                  </Pressable>
                ) : null}
                {filtered.length === 0 ? <Text style={styles.noMatch}>No matches</Text> : null}
                {filtered.map((o) => {
                  const on = !actionMode && o.id === value;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => pick(o.id)}
                      style={[styles.option, on && styles.optionOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <View style={styles.optionBody}>
                        <Text style={styles.optionLabel} numberOfLines={1}>
                          {o.label}
                        </Text>
                        {o.detail ? (
                          <Text style={styles.optionDetail} numberOfLines={1}>
                            {o.detail}
                          </Text>
                        ) : null}
                      </View>
                      {on ? <Check size={16} color={p.clay} strokeWidth={3} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  triggerAction: { borderStyle: "dashed", borderColor: p.clayMid, backgroundColor: p.claySoft },
  triggerOpen: { borderColor: p.clay },
  triggerBody: { flex: 1, minWidth: 0 },
  triggerText: { color: p.text, fontSize: 15 },
  triggerDetail: { color: p.muted, fontSize: 12, marginTop: 1 },
  placeholder: { color: p.faint },
  actionText: { color: p.clayDark, fontWeight: "700" },
  panel: {
    marginTop: 6,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderStrong,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: p.text, fontSize: 14 },
  list: { maxHeight: 280 },
  noMatch: { color: p.muted, padding: 14, fontSize: 13 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  optionOn: { backgroundColor: p.claySoft },
  optionBody: { flex: 1, minWidth: 0 },
  optionLabel: { color: p.text, fontWeight: "600", fontSize: 14 },
  optionDetail: { color: p.muted, fontSize: 12, marginTop: 1 },
  clearLabel: { flex: 1, color: p.muted, fontWeight: "500" },
  empty: { padding: 14, gap: 8 },
  emptyText: { color: p.muted, fontSize: 13 },
  link: { color: p.clayDark, fontWeight: "700", fontSize: 14 },
});
