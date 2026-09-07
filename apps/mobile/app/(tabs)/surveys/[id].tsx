import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSurvey, useUpdateSurvey } from "@/hooks/useApi";
import { EditableFormScreen } from "@/components/ui/EditableFormScreen";

export default function SurveyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSurvey(id);
  const update = useUpdateSurvey();
  const initial = useMemo(
    () =>
      data
        ? {
            projectType: String(data.projectType || "painting"),
            scope: String(data.scope || ""),
            clientRequirements: String(data.clientRequirements || ""),
            existingConditions: String(data.existingConditions || ""),
            notes: String(data.notes || ""),
          }
        : null,
    [data],
  );

  return (
    <EditableFormScreen
      title="Edit survey"
      subtitle={String(data?.number || "")}
      loading={isLoading}
      errorMessage={isError ? (error as { userMessage?: string })?.userMessage || "Failed" : undefined}
      onBack={() => router.back()}
      onRetry={() => refetch()}
      initial={initial}
      fields={[
        { key: "projectType", label: "Project type" },
        { key: "scope", label: "Scope", multiline: true },
        { key: "clientRequirements", label: "Client requirements", multiline: true },
        { key: "existingConditions", label: "Existing conditions", multiline: true },
        { key: "notes", label: "Notes", multiline: true },
      ]}
      onSave={async (form) => {
        await update.mutateAsync({
          id: String(id),
          body: {
            customerId: data?.customerId,
            siteId: data?.siteId,
            projectType: form.projectType || "painting",
            scope: form.scope || null,
            clientRequirements: form.clientRequirements || null,
            existingConditions: form.existingConditions || null,
            notes: form.notes || null,
          },
        });
        refetch();
      }}
    />
  );
}
