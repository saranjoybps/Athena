import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useLabourWorker, useUpdateLabour } from "@/hooks/useApi";
import { EditableFormScreen } from "@/components/ui/EditableFormScreen";

export default function LabourDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useLabourWorker(id);
  const update = useUpdateLabour();
  const initial = useMemo(
    () =>
      data
        ? {
            name: String(data.name || ""),
            phone: String(data.phone || ""),
            trade: String(data.trade || ""),
            skill: String(data.skill || ""),
            dailyRate: String(data.dailyRate || ""),
            overtimeRate: String(data.overtimeRate || ""),
          }
        : null,
    [data],
  );

  return (
    <EditableFormScreen
      title="Edit worker"
      subtitle={String(data?.name || "")}
      loading={isLoading}
      errorMessage={isError ? (error as { userMessage?: string })?.userMessage || "Failed" : undefined}
      onBack={() => router.back()}
      onRetry={() => refetch()}
      initial={initial}
      fields={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone", keyboardType: "phone-pad" },
        { key: "trade", label: "Trade" },
        { key: "skill", label: "Skill" },
        { key: "dailyRate", label: "Daily rate", keyboardType: "numeric" },
        { key: "overtimeRate", label: "OT rate", keyboardType: "numeric" },
      ]}
      onSave={async (form) => {
        await update.mutateAsync({
          id: String(id),
          body: {
            name: form.name,
            phone: form.phone || null,
            trade: form.trade || null,
            skill: form.skill || null,
            dailyRate: form.dailyRate || null,
            overtimeRate: form.overtimeRate || null,
          },
        });
      }}
    />
  );
}
