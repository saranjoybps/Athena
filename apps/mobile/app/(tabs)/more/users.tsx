import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

export default function UsersScreen() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/users");
      return data;
    },
  });
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Users"
      subtitle="Team members"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle="No users listed"
      emptySubtitle="Invite users from the web Users screen."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name || item.displayName || item.email || item.id)}
          subtitle={String(
            item.email ||
              (Array.isArray(item.roles) ? item.roles.join(", ") : item.role) ||
              item.status ||
              "",
          )}
        />
      )}
    />
  );
}
