import { useRouter } from "expo-router";
import { FolderKanban } from "lucide-react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useProjects } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p } from "@/lib/theme";

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
      emptyTitle="No projects yet"
      emptySubtitle="Approve an estimate, then start the project."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name || item.number || item.id)}
          subtitle={item.number ? String(item.number) : undefined}
          meta={`${formatCurrency(String(item.contractValue || 0))} · ${formatDate(item.createdAt)}`}
          status={String(item.status || "active")}
          leading={<FolderKanban size={18} color={p.clay} strokeWidth={2.4} />}
          onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
        />
      )}
    />
  );
}
