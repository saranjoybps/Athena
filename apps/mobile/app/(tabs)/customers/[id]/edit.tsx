import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCustomer, useDeleteCustomer, useUpdateCustomer } from "@/hooks/useApi";
import { CustomerFormScreen } from "@/components/customers/CustomerFormScreen";
import { customerBody, customerDisplayName, customerValuesFrom } from "@/lib/customers";
import { showDeleteError } from "@/lib/confirm";
import { goBackOr } from "@/lib/nav";

export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const customerQ = useCustomer(id);
  const update = useUpdateCustomer();
  const del = useDeleteCustomer();
  const detailHref = `/(tabs)/customers/${id}`;

  return (
    <CustomerFormScreen
      key={customerQ.data ? "ready" : "loading"}
      mode="edit"
      customerId={String(id)}
      initial={customerQ.data ? customerValuesFrom(customerQ.data) : null}
      loading={customerQ.isLoading}
      loadError={customerQ.isError ? (customerQ.error as { userMessage?: string })?.userMessage || "Couldn't load customer." : undefined}
      onRetry={() => customerQ.refetch()}
      saving={update.isPending}
      deleting={del.isPending}
      onBack={() => goBackOr(router, detailHref)}
      onOpenCustomer={(other) => router.push(`/(tabs)/customers/${other}` as never)}
      onSubmit={async (values) => {
        try {
          const body = customerBody(values);
          await update.mutateAsync({ id: String(id), body });
          Toast.show({ type: "success", text1: "Customer updated", text2: customerDisplayName(body) });
          goBackOr(router, detailHref);
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't save changes",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
      onDelete={async () => {
        try {
          await del.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Customer deleted", text2: "Their sites and estimates were removed too." });
          router.dismissTo("/(tabs)/customers" as never);
        } catch (e) {
          showDeleteError("customer", e);
        }
      }}
    />
  );
}
