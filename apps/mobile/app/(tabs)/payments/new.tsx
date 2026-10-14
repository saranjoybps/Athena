import { useCallback, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreatePayment, useCustomers, useInvoice, useInvoices } from "@/hooks/useApi";
import { PaymentFormScreen } from "@/components/payments/PaymentFormScreen";
import { formatCurrency } from "@/lib/format";
import { errorText } from "@/lib/payments";
import type { AthenaRecord } from "@/types";

export default function NewPayment() {
  const router = useRouter();
  const { invoiceId, customerId } = useLocalSearchParams<{ invoiceId?: string; projectId?: string; customerId?: string }>();
  const fixedId = invoiceId ? String(invoiceId) : undefined;
  const invoicesQ = useInvoices(!fixedId);
  const fixedQ = useInvoice(fixedId);
  const customersQ = useCustomers();
  const create = useCreatePayment();

  const open = useMemo(
    () =>
      (invoicesQ.data?.items ?? []).filter(
        (i) =>
          !["paid", "void", "cancelled"].includes(String(i.status)) &&
          Number(i.outstanding ?? i.total ?? 0) > 0 &&
          (!customerId || String(i.customerId || "") === String(customerId)),
      ),
    [invoicesQ.data, customerId],
  );

  const customerName = useCallback(
    (inv: AthenaRecord) => {
      const embedded = (inv.customer as { name?: string } | undefined)?.name;
      if (embedded) return embedded;
      const c = (customersQ.data?.items ?? []).find((x) => String(x.id) === String(inv.customerId || ""));
      return String(c?.name || "");
    },
    [customersQ.data],
  );

  return (
    <PaymentFormScreen
      mode="create"
      invoices={open}
      invoicesLoading={invoicesQ.isLoading}
      lockedInvoice={fixedId ? fixedQ.data ?? null : null}
      customerName={customerName}
      loading={Boolean(fixedId) && fixedQ.isLoading}
      loadError={
        fixedId && fixedQ.isError ? (fixedQ.error as { userMessage?: string })?.userMessage || "Couldn't load the invoice." : undefined
      }
      onRetry={() => fixedQ.refetch()}
      saving={create.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        const invoice = fixedId ? fixedQ.data : open.find((i) => String(i.id) === values.invoiceId);
        try {
          const payment = await create.mutateAsync({
            invoiceId: values.invoiceId,
            amount: values.amount,
            method: values.method,
            reference: values.reference || undefined,
            notes: values.notes || undefined,
          });
          const name = invoice ? customerName(invoice) : "";
          const balance = Math.max(0, Number(invoice?.outstanding ?? 0) - Number(values.amount));
          Toast.show({
            type: "success",
            text1: `${formatCurrency(values.amount)} received${name ? ` from ${name}` : ""}`,
            text2: `${String(invoice?.number || "Invoice")} · ${balance > 0 ? `${formatCurrency(balance)} still due` : "fully paid"}`,
          });
          if (fixedId) router.back();
          else router.replace(`/(tabs)/payments/${String(payment.id)}` as never);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't record payment", text2: errorText(e) });
        }
      }}
    />
  );
}
