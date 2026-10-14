import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useSite, useUpdateSite } from "@/hooks/useApi";
import { SiteFormScreen, siteBody, siteValuesFrom } from "@/components/sites/SiteFormScreen";
import { goBackOr, sitePath } from "@/lib/nav";

export default function EditSite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const siteQ = useSite(id);
  const update = useUpdateSite();
  const ready = Boolean(siteQ.data) && !siteQ.isPlaceholderData;

  return (
    <SiteFormScreen
      key={ready ? "ready" : "loading"}
      mode="edit"
      initial={ready && siteQ.data ? siteValuesFrom(siteQ.data) : null}
      loading={!ready && !siteQ.isError}
      loadError={siteQ.isError ? (siteQ.error as { userMessage?: string })?.userMessage || "Couldn't load site." : undefined}
      onRetry={() => siteQ.refetch()}
      saving={update.isPending}
      onBack={() => goBackOr(router, sitePath(String(id)))}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: siteBody(values) });
          Toast.show({ type: "success", text1: "Site updated", text2: values.name.trim() });
          goBackOr(router, sitePath(String(id), { customerId: values.customerId }));
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save site", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
