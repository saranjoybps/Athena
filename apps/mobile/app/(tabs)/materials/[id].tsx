import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeleteMaterial, useMaterial, useUpdateMaterial } from "@/hooks/useApi";
import {
  MaterialFormScreen,
  materialBody,
  materialValuesFrom,
  type MaterialValues,
} from "@/components/inventory/MaterialFormScreen";

export default function EditMaterial() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useMaterial(id);
  const update = useUpdateMaterial();
  const remove = useDeleteMaterial();

  const initial = useMemo<MaterialValues | null>(() => (data ? materialValuesFrom(data) : null), [data]);

  return (
    <MaterialFormScreen
      key={initial ? String(id) : "loading"}
      mode="edit"
      initial={initial}
      loading={isLoading}
      loadError={isError ? (error as { userMessage?: string })?.userMessage || "Couldn't load this material." : undefined}
      onRetry={() => refetch()}
      saving={update.isPending}
      deleting={remove.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: materialBody(values) });
          Toast.show({ type: "success", text1: "Material updated", text2: `${values.name.trim()} was saved.` });
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
          Toast.show({ type: "success", text1: "Material deleted", text2: `${initial?.name || "The material"} was removed.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Can't delete material",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
