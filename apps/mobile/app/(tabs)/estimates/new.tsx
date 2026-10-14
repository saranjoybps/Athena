import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateEstimate, useOrgBranding } from "@/hooks/useApi";
import { EstimateFormScreen, emptyEstimate, estimateBody } from "@/components/estimates/EstimateFormScreen";
import { formatCurrency } from "@/lib/format";
import { customerPath, goBackOr, sitePath } from "@/lib/nav";

export default function NewEstimate() {
  const { siteId, customerId } = useLocalSearchParams<{ siteId?: string; customerId?: string }>();
  const router = useRouter();
  const create = useCreateEstimate();
  const branding = useOrgBranding();
  const fallback = siteId ? sitePath(siteId, { customerId, tab: "estimates" }) : customerId ? customerPath(customerId, "estimates") : "/(tabs)/customers";

  return (
    <EstimateFormScreen
      mode="create"
      initial={branding.isLoading ? null : emptyEstimate(customerId, siteId, branding.data?.default_gst_rate)}
      loading={branding.isLoading}
      siteLocked={Boolean(siteId)}
      customerFixed={Boolean(customerId)}
      saving={create.isPending}
      onBack={() => goBackOr(router, fallback)}
      onAddSite={(cid) => router.push(`/(tabs)/sites/new?customerId=${cid}` as never)}
      onAddMeasurement={(sid, cid) => router.push(`/(tabs)/measurements/new?siteId=${sid}&customerId=${cid}` as never)}
      onSubmit={async (values) => {
        try {
          const est = await create.mutateAsync(estimateBody(values));
          const total = (est.computed as Record<string, string> | undefined)?.grandTotal;
          Toast.show({
            type: "success",
            text1: `Estimate ${String(est.number || "")} created`.replace("  ", " "),
            text2: `${total ? `${formatCurrency(total)} — ` : ""}review the PDF, then send it to the customer.`,
          });
          router.replace(`/(tabs)/estimates/${est.id}` as never);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't create estimate", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
