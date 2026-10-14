import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateCrew } from "@/hooks/useApi";
import { CrewFormScreen } from "@/components/people/CrewFormScreen";

export default function NewCrew() {
  const router = useRouter();
  const create = useCreateCrew();

  return (
    <CrewFormScreen
      mode="create"
      saving={create.isPending}
      onBack={() => router.back()}
      onAddWorker={() => router.push("/(tabs)/labour/new" as never)}
      onSubmit={async ({ name, memberIds }) => {
        try {
          await create.mutateAsync({ name, members: memberIds.map((labourId) => ({ labourId })) });
          Toast.show({
            type: "success",
            text1: "Crew created",
            text2: `${name} · ${memberIds.length} worker${memberIds.length === 1 ? "" : "s"}`,
          });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't create crew",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
