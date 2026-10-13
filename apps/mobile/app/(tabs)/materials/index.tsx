import { useMemo } from "react";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useMaterials, usePrefetchDetail, useStockSummary } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

export default function MaterialsScreen() {
  const router = useRouter();
  const q = useMaterials();
  const stock = useStockSummary();
  const prefetch = usePrefetchDetail();
  const items = q.data?.items ?? [];

  const stockByMaterial = useMemo(() => {
    const map: Record<string, { qty: string; low?: boolean }> = {};
    for (const row of stock.data?.items ?? []) {
      const mid = String(row.materialId || "");
      if (!mid) continue;
      const prev = map[mid];
      const qty = Number(prev?.qty || 0) + Number(row.onHand || row.qty || 0);
      map[mid] = { qty: String(qty), low: Boolean(row.lowStock) || prev?.low };
    }
    return map;
  }, [stock.data?.items]);

  return (
    <ModuleListScreen
      title="Materials"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching || stock.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => {
        q.refetch();
        stock.refetch();
      }}
      onRefresh={() => {
        q.refetch();
        stock.refetch();
      }}
      onAdd={() => router.push("/(tabs)/materials/new")}
      emptyTitle="No materials"
      emptySubtitle="Build your catalog for estimates and stock."
      renderItem={(item) => {
        const s = stockByMaterial[String(item.id)];
        return (
          <RecordCard
            title={String(item.name)}
            subtitle={[
              String(item.unit || ""),
              formatCurrency(String(item.defaultSellingPrice || item.defaultPurchasePrice || 0)),
              s ? `On hand ${s.qty}` : "No stock row",
              s?.low ? "Low stock" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            meta={String(item.brand || item.category || "")}
            onPress={() => {
              prefetch("materials", item.id);
              router.push(`/(tabs)/materials/${item.id}`);
            }}
          />
        );
      }}
    />
  );
}
