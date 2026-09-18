import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useDeliveryChallans } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

export default function DeliveryChallansScreen() {
  const router = useRouter();
  const q = useDeliveryChallans();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Delivery challans"
      subtitle="Outbound delivery notes"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/delivery-challans/new")}
      emptyTitle="No challans"
      emptySubtitle="Create an outbound delivery challan with vehicle and lines."
      renderItem={(item) => {
        const customer = (item.customer as { name?: string } | undefined)?.name;
        return (
          <RecordCard
            title={String(item.number || item.id)}
            subtitle={[customer, item.vehicleNumber ? `Vehicle ${item.vehicleNumber}` : null, item.date ? formatDate(String(item.date)) : null]
              .filter(Boolean)
              .join(" · ")}
            meta={item.status ? String(item.status) : undefined}
            onPress={() => router.push(`/(tabs)/delivery-challans/${item.id}`)}
          />
        );
      }}
    />
  );
}
