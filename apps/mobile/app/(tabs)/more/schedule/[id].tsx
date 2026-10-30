import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeleteSchedule, useSchedules, useUpdateSchedule } from "@/hooks/useApi";
import { ScheduleFormScreen } from "@/components/schedule/ScheduleFormScreen";

function errorText(e: unknown) {
  return (e as { userMessage?: string })?.userMessage || "Please try again.";
}

export default function EditSchedule() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const schedulesQ = useSchedules();
  const update = useUpdateSchedule();
  const remove = useDeleteSchedule();

  const row = useMemo(() => (schedulesQ.data?.items ?? []).find((s) => String(s.id) === String(id)), [schedulesQ.data, id]);
  const initial = row
    ? {
        projectId: String(row.projectId || ""),
        crewId: String(row.crewId || ""),
        startDate: String(row.startDate || "").slice(0, 10),
        endDate: String(row.endDate || row.startDate || "").slice(0, 10),
        workingDates: Array.isArray(row.workingDates) ? row.workingDates.map((d) => String(d).slice(0, 10)) : undefined,
      }
    : null;
  const missing = !schedulesQ.isLoading && !schedulesQ.isError && !row;

  return (
    <ScheduleFormScreen
      mode="edit"
      scheduleId={String(id)}
      initial={initial}
      loading={schedulesQ.isLoading}
      loadError={
        schedulesQ.isError
          ? (schedulesQ.error as { userMessage?: string })?.userMessage || "Couldn't load the schedule."
          : missing
            ? "This schedule was removed."
            : undefined
      }
      onRetry={() => schedulesQ.refetch()}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({
            id: String(id),
            body: { crewId: values.crewId, startDate: values.startDate, endDate: values.endDate, workingDates: values.workingDates ?? null },
          });
          Toast.show({ type: "success", text1: "Schedule updated", text2: "Attendance follows the new dates." });
          router.back();
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't update schedule", text2: errorText(e) });
        }
      }}
      onDelete={async () => {
        try {
          await remove.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Schedule removed" });
          router.back();
        } catch (e) {
          Toast.show({ type: "error", text1: "Can't remove schedule", text2: errorText(e) });
        }
      }}
    />
  );
}
