import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, FolderKanban, Search, SlidersHorizontal, X } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { usePrefetchDetail, useProjects } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { projectStatusMeta } from "@/lib/projects";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

type Filter = "open" | "scheduled" | "active" | "on_hold" | "completed" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "scheduled", label: "Scheduled" },
  { key: "active", label: "In progress" },
  { key: "on_hold", label: "On hold" },
  { key: "completed", label: "Completed" },
];

const DEFAULT_FILTER: Filter = "all";

export default function ProjectsScreen() {
  const router = useRouter();
  const q = useProjects();
  const prefetch = usePrefetchDetail();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const all = q.data?.items ?? [];

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...all]
      .filter((pr) => {
        const status = String(pr.status || "scheduled");
        if (filter === "open" && status === "completed") return false;
        if (filter !== "open" && filter !== "all" && status !== filter) return false;
        if (!needle) return true;
        return [pr.name, pr.number].some((v) => String(v || "").toLowerCase().includes(needle));
      })
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }, [all, query, filter]);

  const open = all.filter((pr) => pr.status !== "completed");
  const pipeline = open.reduce((s, pr) => s + Math.max(0, Number(pr.contractValue || 0) - Number(pr.billedToDate || 0)), 0);
  const subtitle = all.length ? `${open.length} open${pipeline > 0 ? ` · ${formatCurrency(pipeline)} left to bill` : ""}` : undefined;
  const filtering = Boolean(query.trim()) || filter !== DEFAULT_FILTER;
  const activeLabel = FILTERS.find((f) => f.key === filter)?.label;

  return (
    <ModuleListScreen
      title="Projects"
      subtitle={subtitle}
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage || "Couldn't load projects." : undefined}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle={filtering ? "No matching projects" : "No projects yet"}
      emptySubtitle={filtering ? "Try a different name or filter." : "Projects start from an approved estimate: open a customer's estimate and tap Start project."}
      emptyActionLabel={filtering ? "Clear filters" : "Open customers"}
      onEmptyAction={
        filtering
          ? () => {
              setQuery("");
              setFilter(DEFAULT_FILTER);
            }
          : () => router.navigate("/(tabs)/customers" as never)
      }
      headerExtra={
        <View style={styles.tools}>
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Search size={18} color={p.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search project name or number"
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
              style={[styles.filterBtn, (showFilters || filter !== DEFAULT_FILTER) && styles.filterBtnOn]}
              accessibilityRole="button"
              accessibilityLabel={showFilters ? "Hide filters" : "Show filters"}
              accessibilityState={{ expanded: showFilters }}
            >
              <SlidersHorizontal size={19} color={showFilters || filter !== DEFAULT_FILTER ? "#fff" : p.text} strokeWidth={2.3} />
              {filter !== DEFAULT_FILTER && !showFilters ? <View style={styles.filterDot} /> : null}
            </Pressable>
          </View>
          {showFilters ? (
            <View style={styles.filterPanel}>
              <Text style={styles.filterTitle}>Status</Text>
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
          ) : filter !== DEFAULT_FILTER ? (
            <View style={styles.chips}>
              <Pressable onPress={() => setFilter(DEFAULT_FILTER)} style={[styles.chip, styles.chipOn, styles.activeChip]} accessibilityLabel="Clear filter">
                <Text style={[styles.chipText, styles.chipTextOn]}>{activeLabel}</Text>
                <X size={14} color="#fff" />
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      renderItem={(item) => (
        <ProjectRow
          project={item}
          onPress={() => {
            prefetch("projects", item.id);
            router.push(`/(tabs)/projects/${item.id}` as never);
          }}
        />
      )}
    />
  );
}

function ProjectRow({ project, onPress }: { project: AthenaRecord; onPress: () => void }) {
  const status = projectStatusMeta(project.status);
  const progress = Math.max(0, Math.min(100, Number(project.completionPercent || 0)));
  const contract = Number(project.contractValue || 0);
  const billed = Number(project.billedToDate || 0);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={String(project.name || project.number || "Project")}>
      <View style={styles.tile}>
        <FolderKanban size={20} color={p.clayDark} strokeWidth={2.3} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {String(project.name || project.number || "Project")}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {[project.number, project.startDate ? `Starts ${formatDate(String(project.startDate))}` : formatDate(String(project.createdAt || ""))].filter(Boolean).map(String).join(" · ")}
        </Text>
        <View style={styles.meta}>
          <View style={[styles.pill, { backgroundColor: status.bg }]}>
            <Text style={[styles.pillText, { color: status.fg }]}>{status.label}</Text>
          </View>
          <Text style={styles.metaText}>
            {formatCurrency(contract)}
            {billed > 0 ? ` · ${Math.round((billed / (contract || billed)) * 100)}% billed` : ""}
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
      </View>
      <ChevronRight size={18} color={p.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tools: { gap: 10, marginBottom: 4 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipOn: { backgroundColor: p.text, borderColor: p.text },
  chipText: { color: p.muted, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: "#fff" },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  tile: { width: 44, height: 44, borderRadius: 14, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { color: p.text, fontSize: 16, fontWeight: "700" },
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "800" },
  metaText: { color: p.text, fontSize: 12, fontWeight: "700" },
  track: { height: 5, borderRadius: 3, backgroundColor: p.slateSoft, overflow: "hidden", marginTop: 8 },
  fill: { height: 5, borderRadius: 3, backgroundColor: p.clay },
});
