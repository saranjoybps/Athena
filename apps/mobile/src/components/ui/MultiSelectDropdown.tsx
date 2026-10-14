import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { fieldStyles } from "@/components/ui/FormField";
import { lightPalette as p, radius } from "@/lib/theme";

export type DropdownOption = { id: string; label: string; detail?: string };

type Props = {
  options: DropdownOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  noun: { one: string; many: string };
  error?: string;
  emptyText?: string;
  emptyAction?: { label: string; onPress: () => void };
};

export function MultiSelectDropdown({ options, selected, onChange, placeholder, noun, error, emptyText, emptyAction }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedOptions = useMemo(() => options.filter((o) => selectedSet.has(o.id)), [options, selectedSet]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.detail || "").toLowerCase().includes(q));
  }, [options, query]);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const summary =
    selectedOptions.length === 0
      ? placeholder
      : `${selectedOptions.length} ${selectedOptions.length === 1 ? noun.one : noun.many} selected`;
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedSet.has(o.id));

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[fieldStyles.input, styles.trigger, error ? fieldStyles.inputError : null, open && styles.triggerOpen]}
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.triggerText, selectedOptions.length === 0 && styles.placeholder]} numberOfLines={1}>
          {summary}
        </Text>
        {open ? <ChevronUp size={20} color={p.muted} /> : <ChevronDown size={20} color={p.muted} />}
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
                    placeholder="Search"
                    placeholderTextColor={p.faint}
                    style={styles.searchInput}
                  />
                </View>
              ) : null}
              <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filtered.length === 0 ? <Text style={styles.noMatch}>No matches</Text> : null}
                {filtered.map((o) => {
                  const on = selectedSet.has(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => toggle(o.id)}
                      style={[styles.option, on && styles.optionOn]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Avatar name={o.label} seed={o.id} size={34} />
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
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.footer}>
                <Pressable
                  hitSlop={6}
                  onPress={() => {
                    const ids = filtered.map((o) => o.id);
                    onChange(
                      allFilteredSelected
                        ? selected.filter((id) => !ids.includes(id))
                        : Array.from(new Set([...selected, ...ids])),
                    );
                  }}
                >
                  <Text style={styles.link}>{allFilteredSelected ? "Clear" : "Select all"}</Text>
                </Pressable>
                <Pressable style={styles.doneBtn} onPress={() => setOpen(false)}>
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : null}

      {!open && selectedOptions.length > 0 ? (
        <View style={styles.chips}>
          {selectedOptions.map((o) => (
            <View key={o.id} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {o.label}
              </Text>
              <Pressable onPress={() => toggle(o.id)} hitSlop={8} accessibilityLabel={`Remove ${o.label}`}>
                <X size={14} color={p.clayDark} strokeWidth={2.6} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  triggerOpen: { borderColor: p.clay },
  triggerText: { flex: 1, color: p.text, fontSize: 15 },
  placeholder: { color: p.faint },
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
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  optionOn: { backgroundColor: p.claySoft },
  optionBody: { flex: 1, minWidth: 0 },
  optionLabel: { color: p.text, fontWeight: "600", fontSize: 14 },
  optionDetail: { color: p.muted, fontSize: 12, marginTop: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: p.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: p.clay, borderColor: p.clay },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: p.border,
  },
  link: { color: p.clayDark, fontWeight: "700", fontSize: 14 },
  doneBtn: { backgroundColor: p.clay, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { padding: 14, gap: 8 },
  emptyText: { color: p.muted, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: p.claySoft,
    borderWidth: 1,
    borderColor: p.clayMid,
  },
  chipText: { color: p.clayDark, fontWeight: "600", fontSize: 13, flexShrink: 1 },
});
