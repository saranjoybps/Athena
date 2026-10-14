import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ExpenseFormScreen, expenseBody, expenseValuesFrom } from "@/components/projects/ExpenseFormScreen";
import { useDeleteExpense, useExpense, useUpdateExpense } from "@/hooks/useApi";
import { goBackOr, projectPath } from "@/lib/nav";

export default function ExpenseDetail() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const router = useRouter();
  const expenseQ = useExpense(id);
  const update = useUpdateExpense();
  const remove = useDeleteExpense();
  const expense = expenseQ.data;
  const pid = String(projectId || expense?.projectId || "");
  const back = pid ? projectPath(pid, "budget") : "/(tabs)/projects";

  return (
    <ExpenseFormScreen
      key={expense ? "ready" : "loading"}
      mode="edit"
      projectId={pid}
      initial={expense ? expenseValuesFrom(expense) : null}
      loading={expenseQ.isLoading}
      loadError={expenseQ.isError ? (expenseQ.error as { userMessage?: string })?.userMessage || "Couldn't load this expense." : undefined}
      onRetry={() => expenseQ.refetch()}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => goBackOr(router, back)}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: expenseBody(values) });
          Toast.show({ type: "success", text1: "Expense updated" });
          goBackOr(router, back);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save expense", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
      onDelete={async () => {
        try {
          await remove.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Expense deleted", text2: "Removed from the project's spend." });
          goBackOr(router, back);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't delete expense", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
