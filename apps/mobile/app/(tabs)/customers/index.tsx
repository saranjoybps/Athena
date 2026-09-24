import { useRouter } from "expo-router";
import { User } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useCustomers } from "@/hooks/useApi";
import { lightPalette as p } from "@/lib/theme";

export default function CustomersScreen() {
  const router = useRouter();
  const q = useCustomers();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Customers"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle="No customers yet"
      emptySubtitle="Use the + button below to add a customer, then open a site to continue."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name)}
          subtitle={[item.phone, item.address || item.email].filter(Boolean).map(String).join(" · ")}
          leading={<User size={18} color={p.clay} strokeWidth={2.4} />}
          onPress={() => router.push(`/(tabs)/customers/${item.id}`)}
        />
      )}
    />
  );
}
