import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { SiteRow } from "@/components/customers/WorkflowRows";
import { usePrefetchDetail, useSites } from "@/hooks/useApi";
import { goBackOr, sitePath } from "@/lib/nav";

export default function SitesScreen() {
  const router = useRouter();
  const q = useSites();
  const prefetch = usePrefetchDetail();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Sites"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => goBackOr(router, "/(tabs)/customers")}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle="No sites"
      emptySubtitle="Open a customer and add their job location."
      emptyActionLabel="Open customers"
      onEmptyAction={() => router.navigate("/(tabs)/customers" as never)}
      renderItem={(item) => (
        <SiteRow
          site={item}
          onPress={() => {
            prefetch("sites", item.id);
            router.push(sitePath(String(item.id), { customerId: item.customerId ? String(item.customerId) : undefined }) as never);
          }}
        />
      )}
    />
  );
}
