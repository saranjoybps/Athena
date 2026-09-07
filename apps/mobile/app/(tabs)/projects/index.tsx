import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useProjects } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ProjectsScreen() {
  const router = useRouter();
  const q = useProjects();
  const items = q.data?.items ?? [];
  return (
    <ModuleListScreen
      title="Projects"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/projects/new")}
      emptyTitle="No projects yet"
      emptySubtitle="Start from an accepted quote."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name || item.number || item.id)}
          subtitle={item.number ? String(item.number) : undefined}
          meta={`${formatCurrency(String(item.contractValue || 0))} · ${formatDate(item.createdAt)}`}
          status={String(item.status || "active")}
          onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
        />
      )}
    />
  );
}
