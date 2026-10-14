import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useReviseEstimate } from "@/hooks/useApi";
import { EstimateFormScreen, estimateBody, estimateValuesFrom } from "@/components/estimates/EstimateFormScreen";
import { useEstimateState } from "@/components/estimates/EstimateView";
import { formatCurrency } from "@/lib/format";
import { goBackOr } from "@/lib/nav";

export default function EditEstimate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { estimateQ, workflowQ, estimate, project, status } = useEstimateState(id);
  const revise = useReviseEstimate();
  const ready = Boolean(estimate) && !workflowQ.isLoading;
  const lockedReason = !ready
    ? undefined
    : project
      ? "This estimate is locked because a project was started from it."
      : status === "approved"
        ? "This estimate is approved. Reopen it for changes before editing."
        : status === "rejected"
          ? "This estimate was rejected. Create a new estimate for the site instead."
          : undefined;
  const fallback = `/(tabs)/estimates/${id}`;

  return (
    <EstimateFormScreen
      key={ready ? "ready" : "loading"}
      mode="edit"
      number={estimate?.number ? String(estimate.number) : undefined}
      version={Number(estimate?.version || 1)}
      initial={ready && estimate ? estimateValuesFrom(estimate) : null}
      siteLocked
      lockedReason={lockedReason}
      loading={estimateQ.isLoading || workflowQ.isLoading}
      loadError={estimateQ.isError ? (estimateQ.error as { userMessage?: string })?.userMessage || "Couldn't load estimate." : undefined}
      onRetry={() => estimateQ.refetch()}
      saving={revise.isPending}
      onBack={() => goBackOr(router, fallback)}
      onAddMeasurement={(sid, cid) => router.push(`/(tabs)/measurements/new?siteId=${sid}&customerId=${cid}` as never)}
      onSubmit={async (values) => {
        try {
          const saved = await revise.mutateAsync({ id: String(id), body: estimateBody(values) });
          const total = (saved.computed as Record<string, string> | undefined)?.grandTotal;
          Toast.show({
            type: "success",
            text1: `Estimate updated to v${String(saved.version || "")}`,
            text2: `${total ? `${formatCurrency(total)} — ` : ""}PDF refreshed.`,
          });
          goBackOr(router, fallback);
        } catch (e) {
          const msg = (e as { userMessage?: string })?.userMessage || "Please try again.";
          Toast.show({ type: "error", text1: msg.toLowerCase().includes("locked") || msg.includes("approved") ? "Estimate is locked" : "Couldn't save estimate", text2: msg });
        }
      }}
    />
  );
}
