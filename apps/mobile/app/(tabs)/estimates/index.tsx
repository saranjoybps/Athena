import { View } from "react-native";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { EstimateRow } from "@/components/customers/WorkflowRows";
import { useEstimateDrawer } from "@/components/estimates/EstimateDrawer";
import { useEstimates } from "@/hooks/useApi";
import { goBackOr } from "@/lib/nav";

export default function EstimatesScreen() {
  const router = useRouter();
  const q = useEstimates();
  const drawer = useEstimateDrawer();
  const items = [...(q.data?.items ?? [])].sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return (
    <View style={{ flex: 1 }}>
      <ModuleListScreen
        title="Estimates"
        items={items}
        loading={q.isLoading}
        refreshing={q.isRefetching}
        errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
        onBack={() => goBackOr(router, "/(tabs)/customers")}
        onRetry={() => q.refetch()}
        onRefresh={() => q.refetch()}
        emptyTitle="No estimates"
        emptySubtitle="Open a customer's site and create an estimate from its measurement."
        emptyActionLabel="Open customers"
        onEmptyAction={() => router.navigate("/(tabs)/customers" as never)}
        renderItem={(item) => <EstimateRow estimate={item} onPress={() => drawer.open(String(item.id))} />}
      />
      {drawer.element}
    </View>
  );
}
