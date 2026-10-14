import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateSchedule } from "@/hooks/useApi";
import { ScheduleFormScreen } from "@/components/schedule/ScheduleFormScreen";
import { localIso } from "@/lib/attendance";

export default function NewSchedule() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const create = useCreateSchedule();
  const today = localIso();

  return (
    <ScheduleFormScreen
      mode="create"
      initial={projectId ? { projectId: String(projectId), crewId: "", startDate: today, endDate: today } : null}
      saving={create.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await create.mutateAsync(values);
          Toast.show({ type: "success", text1: "Crew scheduled", text2: "Attendance can be marked for these dates." });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't schedule crew",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
