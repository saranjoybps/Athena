import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeleteMeasurement, useMeasurement, useUpdateMeasurement } from "@/hooks/useApi";
import { MeasurementFormScreen, measurementBody, measurementBrief, measurementValuesFrom } from "@/components/measurements/MeasurementFormScreen";
import { showDeleteError } from "@/lib/confirm";
import { goBackOr, sitePath } from "@/lib/nav";

export default function MeasurementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const measurementQ = useMeasurement(id);
  const update = useUpdateMeasurement();
  const del = useDeleteMeasurement();
  const m = measurementQ.data;
  const fallback = m?.siteId ? sitePath(String(m.siteId), { customerId: String(m.customerId || ""), tab: "measurements" }) : "/(tabs)/customers";

  return (
    <MeasurementFormScreen
      key={m ? "ready" : "loading"}
      mode="edit"
      initial={m ? measurementValuesFrom(m) : null}
      siteLocked={Boolean(m?.siteId)}
      customerFixed={Boolean(m?.customerId)}
      loading={measurementQ.isLoading}
      loadError={measurementQ.isError ? (measurementQ.error as { userMessage?: string })?.userMessage || "Couldn't load measurement." : undefined}
      onRetry={() => measurementQ.refetch()}
      saving={update.isPending}
      deleting={del.isPending}
      onBack={() => goBackOr(router, fallback)}
      onAddSite={(cid) => router.push(`/(tabs)/sites/new?customerId=${cid}` as never)}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: measurementBody(values) });
          Toast.show({ type: "success", text1: "Measurement updated", text2: measurementBrief(values) || undefined });
          goBackOr(router, fallback);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save measurement", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
      onDelete={async () => {
        try {
          await del.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Measurement deleted" });
          goBackOr(router, fallback);
        } catch (e) {
          showDeleteError("measurement", e);
        }
      }}
    />
  );
}
