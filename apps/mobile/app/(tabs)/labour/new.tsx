import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateLabour } from "@/hooks/useApi";
import { WorkerFormScreen } from "@/components/people/WorkerFormScreen";

export default function NewWorker() {
  const router = useRouter();
  const create = useCreateLabour();

  return (
    <WorkerFormScreen
      mode="create"
      saving={create.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await create.mutateAsync(values);
          Toast.show({ type: "success", text1: "Worker added", text2: `${values.name} is now in your team.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't add worker",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
