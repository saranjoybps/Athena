import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useStockSummary } from "@/hooks/useApi";

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
              String(item.warehouse || "main"),
              item.unit ? String(item.unit) : null,
              low ? "Low stock" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            status={low ? "low" : undefined}
            onPress={
              item.materialId
                ? () => router.push(`/(tabs)/materials/${String(item.materialId)}` as never)
                : undefined
            }
          />
        );
      }}
    />
  );
}
