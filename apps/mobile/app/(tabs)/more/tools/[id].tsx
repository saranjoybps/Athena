import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeleteTool, useTool, useUpdateTool } from "@/hooks/useApi";
import { ToolFormScreen, toolBody, toolValuesFrom, type ToolValues } from "@/components/inventory/ToolFormScreen";

export default function EditTool() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useTool(id);
  const update = useUpdateTool();
  const remove = useDeleteTool();

  const initial = useMemo<ToolValues | null>(() => (data ? toolValuesFrom(data) : null), [data]);

  return (
    <ToolFormScreen
      key={initial ? String(id) : "loading"}
      mode="edit"
      initial={initial}
      loading={isLoading}
      loadError={isError ? (error as { userMessage?: string })?.userMessage || "Couldn't load this tool." : undefined}
      onRetry={() => refetch()}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: toolBody(values) });
          Toast.show({ type: "success", text1: "Tool updated", text2: `${values.name.trim()} was saved.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't save changes",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
      onDelete={async () => {
        try {
          await remove.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Tool deleted", text2: `${initial?.name || "The tool"} was removed.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Can't delete tool",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
