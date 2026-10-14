import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeletePayment, useInvoice, usePayment, useUpdatePayment } from "@/hooks/useApi";
import { PaymentFormScreen, type PaymentValues } from "@/components/payments/PaymentFormScreen";
import { formatCurrency } from "@/lib/format";
import { errorText, methodMeta } from "@/lib/payments";

export default function EditPayment() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentQ = usePayment(String(id));
  const payment = paymentQ.data;
  const invoiceQ = useInvoice(payment?.invoiceId ? String(payment.invoiceId) : undefined);
  const update = useUpdatePayment();
  const remove = useDeletePayment();

  const initial: PaymentValues | null =
    payment && invoiceQ.data
      ? {
          invoiceId: String(payment.invoiceId || ""),
          amount: String(Number(payment.amount || 0)),
          method: methodMeta(payment.method).id,
          reference: String(payment.reference || ""),
          notes: String(payment.notes || ""),
        }
      : null;
  const error = paymentQ.error || invoiceQ.error;

  return (
    <PaymentFormScreen
      mode="edit"
      initial={initial}
      invoices={[]}
      lockedInvoice={invoiceQ.data ?? null}
      originalAmount={Number(payment?.amount || 0)}
      customerName={() => String(payment?.customerName || "")}
      loading={paymentQ.isLoading || invoiceQ.isLoading}
      loadError={error ? (error as { userMessage?: string })?.userMessage || "Couldn't load the payment." : undefined}
      onRetry={() => {
        paymentQ.refetch();
        invoiceQ.refetch();
      }}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({
            id: String(id),
            body: {
              amount: values.amount,
              method: values.method,
              reference: values.reference || null,
              notes: values.notes || null,
            },
          });
          Toast.show({
            type: "success",
            text1: "Payment updated",
            text2: `${formatCurrency(values.amount)} · ${methodMeta(values.method).label}`,
          });
          router.back();
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't update payment", text2: errorText(e) });
        }
      }}
      onDelete={async () => {
        if (!payment) return;
        try {
          const result = await remove.mutateAsync(payment);
          Toast.show({
            type: "success",
            text1: "Payment deleted",
            text2: result.projectReopened
              ? "The invoice balance is open again and the project moved back to its previous status."
              : "The amount was added back to the invoice balance.",
          });
          if (router.canDismiss()) router.dismissAll();
          router.replace("/(tabs)/payments" as never);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't delete payment", text2: errorText(e) });
        }
      }}
    />
  );
}
