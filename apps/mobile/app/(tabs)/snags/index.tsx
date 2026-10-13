import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useResolveSnag, useSnags } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";

export default function SnagsScreen() {
  const router = useRouter();
  const q = useSnags();
  const resolve = useResolveSnag();
  const items = q.data?.items ?? [];

  return (
    <ModuleListScreen
      title="Snags"
      items={items}
      loading={q.isLoading}
      refreshing={q.isRefetching}
      errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
      onBack={() => router.back()}
      onRetry={() => q.refetch()}
      onRefresh={() => q.refetch()}
      onAdd={() => router.push("/(tabs)/snags/new")}
      emptyTitle="No snags"
      emptySubtitle="Log defects from the site."
      renderItem={(item) => (
        <RecordCard
          title={String(item.description || item.id)}
          subtitle={String(item.location || "")}
          meta={formatDate(item.createdAt)}
          status={String(item.status || "open")}
          onPress={async () => {
            if (String(item.status) === "resolved" || String(item.status) === "verified") return;
            try {
              await resolve.mutateAsync(item.id);
              Toast.show({ type: "success", text1: "Snag resolved" });
            } catch (e) {
              Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
            }
          }}
        />
      )}
    />
  );
}
