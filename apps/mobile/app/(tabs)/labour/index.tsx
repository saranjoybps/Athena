import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useLabour } from "@/hooks/useApi";

export default function LabourScreen() {
  const router = useRouter();
  const q = useLabour();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Labour"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/labour/new")}
      emptyTitle="No workers"
      emptySubtitle="Add painters, masons, and helpers."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={String(item.trade || item.skill || "")}
          meta={`${item.phone || ""} · ₹${item.dailyRate || "—"}/day`}
          onPress={() => router.push(`/(tabs)/labour/${item.id}`)}
        />
      )}
    />
  );
}
