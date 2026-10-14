import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Package } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { Avatar } from "@/components/ui/Avatar";
import { categoryLabel } from "@/components/inventory/MaterialFormScreen";
import { useMaterials, usePrefetchDetail } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import type { AthenaRecord } from "@/types";
import { lightPalette as p, radius, spacing, softShadow } from "@/lib/theme";

export default function MaterialsScreen() {
  const router = useRouter();
  const q = useMaterials();
  const prefetch = usePrefetchDetail();

  return (
    <ModuleListScreen
      title="Materials"
      items={q.data?.items ?? []}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/materials/new")}
      emptyTitle="No materials yet"
      emptySubtitle="Add the materials you use so estimates and invoices can pick their rates."
      renderItem={(item) => (
        <MaterialRow
          material={item}
          onPress={() => {
            prefetch("materials", item.id);
            router.push(`/(tabs)/materials/${item.id}`);
          }}
        />
      )}
    />
  );
}

function MaterialRow({ material, onPress }: { material: AthenaRecord; onPress: () => void }) {
  const name = String(material.name || "Unnamed material");
  const detail = [String(material.brand || "").trim(), categoryLabel(material.category)].filter(Boolean).join(" · ");
  const price = material.defaultSellingPrice ?? material.defaultPurchasePrice;
  const unit = String(material.unit || "").trim();
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
      <Avatar name={name} seed={String(material.id)} icon={Package} shape="rounded" />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {price != null && price !== "" ? (
        <View style={styles.price}>
          <Text style={styles.priceValue}>{formatCurrency(String(price))}</Text>
          {unit ? <Text style={styles.priceUnit}>per {unit}</Text> : null}
        </View>
      ) : null}
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
  subtitle: { color: p.muted, fontSize: 13, marginTop: 2, fontWeight: "500" },
  price: { alignItems: "flex-end" },
  priceValue: { color: p.text, fontSize: 15, fontWeight: "800" },
  priceUnit: { color: p.faint, fontSize: 12, marginTop: 1, fontWeight: "600" },
});
