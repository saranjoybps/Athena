import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

export default function PhotosScreen() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["photos"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/photos");
      return data;
    },
  });
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Photos"
      subtitle="Site progress photos"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle="No photos yet"
      emptySubtitle="Upload site photos from the web app or future camera flow."
      renderItem={(item) => (
        <RecordCard
          title={String(item.category || item.description || "Photo")}
          subtitle={String(item.url || item.projectId || "")}
        />
      )}
    />
  );
}
