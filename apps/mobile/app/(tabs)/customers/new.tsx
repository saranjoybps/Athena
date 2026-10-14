import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateCustomer } from "@/hooks/useApi";
import { CustomerFormScreen } from "@/components/customers/CustomerFormScreen";
import { customerBody, customerDisplayName } from "@/lib/customers";
import { quotaReached } from "@/lib/entitlements";
import { goBackOr } from "@/lib/nav";
import { useAuthStore } from "@/store";

export default function NewCustomer() {
  const router = useRouter();
  const create = useCreateCustomer();
  const entitlements = useAuthStore((s) => s.user?.entitlements);
  const limitReached = quotaReached(entitlements, "customers");

  return (
    <CustomerFormScreen
      mode="create"
      saving={create.isPending}
      blockedReason={limitReached ? "You've reached the customer limit on your plan. Upgrade to add more customers." : undefined}
      onBack={() => goBackOr(router, "/(tabs)/customers")}
      onOpenCustomer={(id) => router.replace(`/(tabs)/customers/${id}` as never)}
      onSubmit={async (values) => {
        try {
          const body = customerBody(values);
          const doc = await create.mutateAsync(body);
          Toast.show({
            type: "success",
            text1: "Customer added",
            text2: `${customerDisplayName(body)} — add their first site next.`,
          });
          router.replace(`/(tabs)/customers/${doc.id}` as never);
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't add customer",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
