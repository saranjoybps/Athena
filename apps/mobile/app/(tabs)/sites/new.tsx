import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCachedCustomer, useCreateSite, useCustomer } from "@/hooks/useApi";
import { SiteFormScreen, siteBody } from "@/components/sites/SiteFormScreen";
import { quotaReached } from "@/lib/entitlements";
import { customerPath, goBackOr, sitePath } from "@/lib/nav";
import { useAuthStore } from "@/store";

export default function NewSite() {
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();
  const create = useCreateSite();
  const cached = useCachedCustomer(customerId);
  const customerQ = useCustomer(customerId && !cached ? customerId : undefined);
  const entitlements = useAuthStore((s) => s.user?.entitlements);
  const lockedCustomer = customerId ? cached || customerQ.data || { id: customerId } : null;

  return (
    <SiteFormScreen
      key={lockedCustomer?.id ? "locked" : "free"}
      mode="create"
      lockedCustomer={lockedCustomer}
      saving={create.isPending}
      blockedReason={quotaReached(entitlements, "sites") ? "You've reached the site limit on your plan. Upgrade to add more sites." : undefined}
      onBack={() => goBackOr(router, customerId ? customerPath(customerId, "sites") : "/(tabs)/customers")}
      onSubmit={async (values) => {
        try {
          const site = await create.mutateAsync(siteBody(values));
          Toast.show({ type: "success", text1: "Site added", text2: `${values.name.trim()} — next, record a survey.` });
          router.replace(sitePath(String(site.id), { customerId: values.customerId }) as never);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't add site", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
