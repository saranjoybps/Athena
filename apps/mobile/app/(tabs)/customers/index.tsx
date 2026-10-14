import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Building2, MapPin, Phone, Search, SlidersHorizontal, X } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { useCustomers, usePrefetchCustomerSummary } from "@/hooks/useApi";
import { customerDisplayName } from "@/lib/customers";
import { formatCurrency } from "@/lib/format";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

type Filter = "all" | "dues" | "company" | "individual";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "dues", label: "With dues" },
  { key: "individual", label: "Individuals" },
  { key: "company", label: "Businesses" },
];

const due = (c: AthenaRecord) => Number(c.outstanding || 0);

export default function CustomersScreen() {
  const router = useRouter();
  const q = useCustomers();
  const prefetchSummary = usePrefetchCustomerSummary();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const all = q.data?.items ?? [];

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return all.filter((c) => {
      if (filter === "dues" && due(c) <= 0) return false;
      if (filter === "company" && c.type !== "company") return false;
      if (filter === "individual" && c.type === "company") return false;
      if (!needle) return true;
      const text = [c.name, c.company, c.email, c.address, c.billingAddress].map((v) => String(v || "").toLowerCase());
      if (text.some((t) => t.includes(needle))) return true;
      return digits.length >= 3 && String(c.phone || "").replace(/\D/g, "").includes(digits);
    });
  }, [all, query, filter]);

  const totalDue = all.reduce((sum, c) => sum + Math.max(due(c), 0), 0);
  const subtitle = all.length
    ? `${all.length} customer${all.length === 1 ? "" : "s"}${totalDue > 0 ? ` · ${formatCurrency(totalDue)} due` : ""}`
    : undefined;
  const filtering = Boolean(query.trim()) || filter !== "all";

  return (
    <ModuleListScreen
      title="Customers"
      subtitle={subtitle}
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage || "Couldn't load customers." : undefined}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle={filtering ? "No matching customers" : "No customers yet"}
      emptySubtitle={
        filtering ? "Try a different name, phone number or filter." : "Add your first customer, then add the site you'll work on."
      }
      emptyActionLabel={filtering ? "Clear filters" : "Add customer"}
      onEmptyAction={
        filtering
          ? () => {
              setQuery("");
              setFilter("all");
            }
          : () => router.push("/(tabs)/customers/new" as never)
      }
      headerExtra={
        <View style={styles.tools}>
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Search size={18} color={p.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name, phone or business"
                placeholderTextColor={p.faint}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                  <X size={16} color={p.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => setShowFilters((v) => !v)}
              style={[styles.filterBtn, (showFilters || filter !== "all") && styles.filterBtnOn]}
              accessibilityRole="button"
              accessibilityLabel={showFilters ? "Hide filters" : "Show filters"}
              accessibilityState={{ expanded: showFilters }}
            >
              <SlidersHorizontal size={19} color={showFilters || filter !== "all" ? "#fff" : p.text} strokeWidth={2.3} />
              {filter !== "all" && !showFilters ? <View style={styles.filterDot} /> : null}
            </Pressable>
          </View>
          {showFilters ? (
            <View style={styles.filterPanel}>
              <Text style={styles.filterTitle}>Show</Text>
              <View style={styles.chips}>
                {FILTERS.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => {
                        setFilter(f.key);
                        setShowFilters(false);
                      }}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : filter !== "all" ? (
            <View style={styles.chips}>
              <Pressable onPress={() => setFilter("all")} style={[styles.chip, styles.chipOn, styles.activeChip]} accessibilityLabel="Clear filter">
                <Text style={[styles.chipText, styles.chipTextOn]}>{FILTERS.find((f) => f.key === filter)?.label}</Text>
                <X size={14} color="#fff" />
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      renderItem={(item) => (
        <CustomerRow
          customer={item}
          onPress={() => {
            prefetchSummary(String(item.id));
            router.push(`/(tabs)/customers/${item.id}` as never);
          }}
        />
      )}
    />
  );
}

function CustomerRow({ customer, onPress }: { customer: AthenaRecord; onPress: () => void }) {
  const business = customer.type === "company";
  const title = customerDisplayName(customer);
  const phone = String(customer.phone || "").trim();
  const contact = business && customer.company ? String(customer.name || "") : "";
  const sites = Number(customer.siteCount || 0);
  const outstanding = due(customer);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <Avatar name={title} seed={String(customer.id)} icon={business ? Building2 : undefined} shape={business ? "rounded" : "circle"} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[contact, phone].filter(Boolean).join(" · ") || "No phone"}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaPill}>
            <MapPin size={12} color={p.muted} />
            <Text style={styles.metaText}>
              {sites ? `${sites} site${sites === 1 ? "" : "s"}` : "No sites"}
            </Text>
          </View>
          {outstanding > 0 ? (
            <View style={[styles.metaPill, styles.duePill]}>
              <Text style={styles.dueText}>{formatCurrency(outstanding)} due</Text>
            </View>
          ) : null}
        </View>
      </View>
      {phone ? (
        <Pressable
          style={styles.iconBtn}
          onPress={() => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Call ${title}`}
        >
          <Phone size={18} color={p.text} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tools: { gap: 10, marginBottom: 4 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  filterBtnOn: { backgroundColor: p.text, borderColor: p.text },
  filterDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: p.clay, borderWidth: 1, borderColor: "#fff" },
  filterPanel: { backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 12, gap: 8, ...softShadow },
  filterTitle: { color: p.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: p.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, color: p.text, fontSize: 15 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  chipOn: { backgroundColor: p.text, borderColor: p.text },
  chipText: { color: p.muted, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: 10,
    ...softShadow,
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontSize: 16, fontWeight: "700" },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  meta: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: p.slateSoft,
  },
  metaText: { color: p.muted, fontSize: 11, fontWeight: "700" },
  duePill: { backgroundColor: p.redSoft },
  dueText: { color: p.red, fontSize: 11, fontWeight: "800" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderStrong,
  },
});
