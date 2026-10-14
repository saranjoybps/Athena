import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCrew, useDeleteCrew, useUpdateCrew } from "@/hooks/useApi";
import { CrewFormScreen, memberIdsFromCrew, type CrewValues } from "@/components/people/CrewFormScreen";

export default function EditCrew() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: crew, isLoading, isError, error, refetch } = useCrew(id);
  const update = useUpdateCrew();
  const remove = useDeleteCrew();

  const initial = useMemo<CrewValues | null>(
    () => (crew ? { name: String(crew.name || ""), memberIds: memberIdsFromCrew(crew.members) } : null),
    [crew],
  );

  return (
    <CrewFormScreen
      key={initial ? String(id) : "loading"}
      mode="edit"
      initial={initial}
      loading={isLoading}
      loadError={isError ? (error as { userMessage?: string })?.userMessage || "Couldn't load this crew." : undefined}
      onRetry={() => refetch()}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => router.back()}
      onAddWorker={() => router.push("/(tabs)/labour/new" as never)}
      onSubmit={async ({ name, memberIds }) => {
        try {
          await update.mutateAsync({
            id: String(id),
            body: { name, members: memberIds.map((labourId) => ({ labourId })), dailyCost: null },
          });
          Toast.show({ type: "success", text1: "Crew updated", text2: `${name} was saved.` });
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
          Toast.show({ type: "success", text1: "Crew deleted", text2: `${initial?.name || "The crew"} was removed.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Can't delete crew",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
