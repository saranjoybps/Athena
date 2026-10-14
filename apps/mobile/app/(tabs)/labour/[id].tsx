import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeleteLabour, useLabourWorker, useUpdateLabour } from "@/hooks/useApi";
import { WorkerFormScreen, type WorkerValues } from "@/components/people/WorkerFormScreen";

export default function EditWorker() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useLabourWorker(id);
  const update = useUpdateLabour();
  const remove = useDeleteLabour();

  const initial = useMemo<WorkerValues | null>(
    () =>
      data
        ? {
            name: String(data.name || ""),
            phone: String(data.phone || ""),
            trade: String(data.trade || data.skill || ""),
            dailyRate: data.dailyRate == null ? "" : String(data.dailyRate),
          }
        : null,
    [data],
  );

  return (
    <WorkerFormScreen
      key={initial ? String(id) : "loading"}
      mode="edit"
      initial={initial}
      loading={isLoading}
      loadError={isError ? (error as { userMessage?: string })?.userMessage || "Couldn't load this worker." : undefined}
      onRetry={() => refetch()}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: values });
          Toast.show({ type: "success", text1: "Worker updated", text2: `${values.name}'s details were saved.` });
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
          Toast.show({ type: "success", text1: "Worker deleted", text2: `${initial?.name || "The worker"} was removed.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Can't delete worker",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
