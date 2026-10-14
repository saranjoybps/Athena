import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, Warehouse, Wrench } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { storageLabel } from "@/components/inventory/ToolFormScreen";
import { usePrefetchDetail, useSites, useTools } from "@/hooks/useApi";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

export default function ToolsScreen() {
  const router = useRouter();
  const q = useTools();
  const sites = useSites();
  const prefetch = usePrefetchDetail();
  const siteById = useMemo(
    () => new Map((sites.data?.items ?? []).map((site) => [String(site.id), String(site.name || "Site")])),
    [sites.data?.items],
  );

  return (
    <ModuleListScreen
      title="Tools"
      items={q.data?.items ?? []}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => {
        q.refetch();
        sites.refetch();
      }}
      onAdd={() => router.push("/(tabs)/more/tools/new" as never)}
      emptyTitle="No tools yet"
      emptySubtitle="Add ladders, mixers and other equipment to track where they are."
      renderItem={(item) => (
        <ToolRow
          tool={item}
          siteName={item.siteId ? siteById.get(String(item.siteId)) : undefined}
          onPress={() => {
            prefetch("inventory", item.id);
            router.push(`/(tabs)/more/tools/${item.id}` as never);
          }}
        />
      )}
    />
  );
}

function ToolRow({ tool, siteName, onPress }: { tool: AthenaRecord; siteName?: string; onPress: () => void }) {
  const name = String(tool.name || "Unnamed tool");
  const qty = Number(tool.qty ?? 0);
  const onSite = Boolean(tool.siteId);
  const LocationIcon = onSite ? MapPin : Warehouse;
  const location = onSite ? siteName || "Assigned site" : storageLabel(tool.warehouse);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${location}`}>
      <Avatar name={name} seed={String(tool.id)} icon={Wrench} shape="rounded" />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.locationRow}>
          <LocationIcon size={13} color={onSite ? p.clayDark : p.muted} strokeWidth={2.4} />
          <Text style={[styles.subtitle, onSite && styles.onSite]} numberOfLines={1}>
            {location}
          </Text>
        </View>
      </View>
      <View style={[styles.qty, qty <= 0 && styles.qtyEmpty]}>
        <Text style={[styles.qtyValue, qty <= 0 && styles.qtyValueEmpty]}>{Number.isFinite(qty) ? qty : 0}</Text>
        <Text style={styles.qtyLabel}>qty</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  subtitle: { color: p.muted, fontSize: 13, fontWeight: "500", flexShrink: 1 },
  onSite: { color: p.clayDark, fontWeight: "600" },
  qty: {
    minWidth: 48,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: p.claySoft,
  },
  qtyEmpty: { backgroundColor: p.redSoft },
  qtyValue: { color: p.clayDark, fontSize: 16, fontWeight: "800" },
  qtyValueEmpty: { color: p.red },
  qtyLabel: { color: p.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});
