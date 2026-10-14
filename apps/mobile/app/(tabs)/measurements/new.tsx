import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateMeasurement } from "@/hooks/useApi";
import { MeasurementFormScreen, emptyMeasurement, measurementBody, measurementBrief } from "@/components/measurements/MeasurementFormScreen";
import { customerPath, goBackOr, sitePath } from "@/lib/nav";

export default function NewMeasurement() {
  const { siteId, customerId } = useLocalSearchParams<{ siteId?: string; customerId?: string }>();
  const router = useRouter();
  const create = useCreateMeasurement();
  const fallback = siteId ? sitePath(siteId, { customerId, tab: "measurements" }) : customerId ? customerPath(customerId, "measurements") : "/(tabs)/customers";

  return (
    <MeasurementFormScreen
      mode="create"
      initial={emptyMeasurement(customerId, siteId)}
      siteLocked={Boolean(siteId)}
      customerFixed={Boolean(customerId)}
      saving={create.isPending}
      onBack={() => goBackOr(router, fallback)}
      onAddSite={(cid) => router.push(`/(tabs)/sites/new?customerId=${cid}` as never)}
      onSubmit={async (values) => {
        try {
          await create.mutateAsync(measurementBody(values));
          const brief = measurementBrief(values);
          Toast.show({ type: "success", text1: "Measurement saved", text2: `${brief ? `${brief} — ` : ""}next, prepare the estimate.` });
          goBackOr(router, sitePath(values.siteId, { customerId: values.customerId, tab: "measurements" }));
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save measurement", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
