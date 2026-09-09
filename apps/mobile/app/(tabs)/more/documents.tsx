import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import apiClient from "@/lib/api";
import type { AthenaRecord, Paginated } from "@/types";

export default function DocumentsScreen() {
  const router = useRouter();
  const q = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AthenaRecord>>("/documents");
      return data;
    },
  });
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Documents"
      subtitle="Files and Cloudinary links"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      emptyTitle="No documents"
      emptySubtitle="Add documents from the web Documents module."
      renderItem={(item) => (
        <RecordCard
          title={String(item.name || item.id)}
          subtitle={String(item.category || item.url || "")}
          onPress={() => {
            const url = String(item.url || "");
            if (url.startsWith("http")) Linking.openURL(url).catch(() => undefined);
          }}
        />
      )}
    />
  );
}
