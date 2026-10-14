import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ExpenseFormScreen, emptyExpense, expenseBody } from "@/components/projects/ExpenseFormScreen";
import { useCreateExpense } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { goBackOr, projectPath } from "@/lib/nav";

export default function NewExpense() {
  const router = useRouter();
  const { projectId: projectIdParam, category } = useLocalSearchParams<{ projectId?: string; category?: string }>();
  const projectId = projectIdParam ? String(projectIdParam) : "";
  const create = useCreateExpense();
  const back = projectId ? projectPath(projectId, "budget") : "/(tabs)/projects";

  return (
    <ExpenseFormScreen
      key={`${projectId || "none"}-${category || ""}`}
      mode="create"
      projectId={projectId}
      initial={category ? { ...emptyExpense, category: String(category) } : emptyExpense}
      loadError={projectId ? undefined : "Open Log expense from a project — the expense is booked against that project."}
      saving={create.isPending}
      onBack={() => goBackOr(router, back)}
      onSubmit={async (values) => {
        try {
          const body = expenseBody(values);
          await create.mutateAsync({
            projectId,
            category: body.category,
            amount: body.amount,
            paidBy: body.paidBy,
            description: body.description || undefined,
            billableToCustomer: body.billableToCustomer,
            budgetLineId: body.budgetLineId || undefined,
          });
          Toast.show({ type: "success", text1: "Expense logged", text2: `${formatCurrency(body.amount)} added to the project's spend.` });
          goBackOr(router, back);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save expense", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
