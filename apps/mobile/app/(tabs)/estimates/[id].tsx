import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCustomer } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { EstimateActions, EstimateBody, useEstimateState } from "@/components/estimates/EstimateView";
import { goBackOr, sitePath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function EstimateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { estimateQ, workflowQ, estimate } = useEstimateState(id);
  const customerId = estimate?.customerId ? String(estimate.customerId) : "";
  const customerQ = useCustomer(customerId || undefined);
  const fallback = estimate?.siteId ? sitePath(String(estimate.siteId), { customerId, tab: "estimates" }) : "/(tabs)/customers";

  const refresh = useCallback(() => {
    void estimateQ.refetch();
    void workflowQ.refetch();
  }, [estimateQ, workflowQ]);

  return (
    <SoftBackground>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={estimateQ.isRefetching} onRefresh={refresh} tintColor={p.clay} />}
        >
          <ScreenHeader
            title={String(estimate?.title || "Estimate")}
            subtitle={estimate?.number ? String(estimate.number) : undefined}
            onBack={() => goBackOr(router, fallback)}
          />
          {estimate ? (
            <View style={styles.actions}>
              <EstimateActions
                id={String(id)}
                contact={{ phone: customerQ.data?.phone ? String(customerQ.data.phone) : null, email: customerQ.data?.email ? String(customerQ.data.email) : null }}
                nav={{
                  edit: (estimateId) => router.push(`/(tabs)/estimates/${estimateId}/edit` as never),
                  project: (projectId) => router.push(`/(tabs)/projects/${projectId}` as never),
                  deleted: () => goBackOr(router, fallback),
                }}
              />
            </View>
          ) : null}
          <EstimateBody id={String(id)} />
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: tabBarClearance, gap: spacing.md },
  actions: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: spacing.md },
});
