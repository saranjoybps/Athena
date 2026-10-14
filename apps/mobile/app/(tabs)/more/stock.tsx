import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useStockSummary } from "@/hooks/useApi";
import { storageLabel } from "@/components/inventory/ToolFormScreen";

export default function StockScreen() {
  const router = useRouter();
  const stock = useStockSummary();
  const items = stock.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Stock"
      subtitle="On-hand quantities for materials and tools"
      items={items}
      loading={stock.isLoading}
      refreshing={stock.isRefetching}
      errorMessage={stock.isError ? (stock.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => stock.refetch()}
      onRefresh={() => stock.refetch()}
      emptyTitle="No stock yet"
      emptySubtitle="Stock appears after materials and tools are added."
      renderItem={(item) => {
        const low = Boolean(item.lowStock);
        const name = String(item.toolName || item.materialName || item.name || "Item");
        return (
          <RecordCard
            title={name}
            subtitle={[
              `Qty ${String(item.onHand ?? item.qty ?? "—")}`,
              storageLabel(item.warehouse),
              item.unit ? String(item.unit) : null,
              low ? "Low stock" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            status={low ? "low" : undefined}
            onPress={() =>
              router.push(
                (item.materialId
                  ? `/(tabs)/materials/${String(item.materialId)}`
                  : `/(tabs)/more/tools/${String(item.id)}`) as never,
              )
            }
          />
        );
      }}
    />
  );
}
