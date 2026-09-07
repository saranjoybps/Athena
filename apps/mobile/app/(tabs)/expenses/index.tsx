import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useExpenses } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ExpensesScreen() {
  const router = useRouter();
  const q = useExpenses();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Expenses"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/expenses/new")}
      emptyTitle="No expenses"
      emptySubtitle="Log cash and UPI spend from the site."
      renderItem={(item) => (
        <RecordCard
          title={String(item.category || "Expense")}
          subtitle={formatCurrency(String(item.amount || 0))}
          meta={`${String(item.description || "")} · ${formatDate(item.createdAt)}`}
          onPress={() => router.push(`/(tabs)/expenses/${item.id}`)}
        />
      )}
    />
  );
}
