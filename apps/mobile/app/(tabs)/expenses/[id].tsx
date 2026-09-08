import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useExpense, useUpdateExpense } from "@/hooks/useApi";
import { EditableFormScreen } from "@/components/ui/EditableFormScreen";
import { projectPath } from "@/lib/nav";

export default function ExpenseDetail() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useExpense(id);
  const update = useUpdateExpense();

  const initial = useMemo(
    () =>
      data
        ? {
            category: String(data.category || ""),
            amount: String(data.amount || ""),
            paidBy: String(data.paidBy || ""),
            description: String(data.description || ""),
            billableToCustomer: data.billableToCustomer ? "yes" : "no",
          }
        : null,
    [data],
  );

  const backTo = projectId
    ? projectPath(String(projectId), "money")
    : data?.projectId
      ? projectPath(String(data.projectId), "money")
      : "/(tabs)/projects";

  return (
    <EditableFormScreen
      title="Edit expense"
      subtitle={String(data?.category || "")}
      loading={isLoading}
      errorMessage={isError ? (error as { userMessage?: string })?.userMessage || "Failed" : undefined}
      onBack={() => router.replace(backTo as never)}
      onRetry={() => refetch()}
      initial={initial}
      fields={[
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", keyboardType: "numeric" },
        { key: "paidBy", label: "Paid by" },
        { key: "billableToCustomer", label: "Billable to customer (yes/no)" },
        { key: "description", label: "Description", multiline: true },
      ]}
      onSave={async (form) => {
        await update.mutateAsync({
          id: String(id),
          body: {
            category: form.category,
            amount: form.amount,
            paidBy: form.paidBy || null,
            description: form.description || null,
            billableToCustomer: String(form.billableToCustomer || "").toLowerCase().startsWith("y"),
          },
        });
        refetch();
        router.replace(backTo as never);
      }}
    />
  );
}
