import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSurvey, useUpdateSurvey } from "@/hooks/useApi";
import { EditableFormScreen } from "@/components/ui/EditableFormScreen";
import { customerPath } from "@/lib/nav";

export default function SurveyDetail() {
  const { id, customerId, fromSite } = useLocalSearchParams<{
    id: string;
    customerId?: string;
    fromSite?: string;
  }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSurvey(id);
  const update = useUpdateSurvey();
  const initial = useMemo(
    () =>
      data
        ? {
            projectType: String(data.projectType || ""),
            date: String(data.date || "").slice(0, 10),
            clientRequirements: String(data.clientRequirements || ""),
            existingConditions: String(data.existingConditions || ""),
            notes: String(data.notes || ""),
          }
        : null,
    [data],
  );

  const custId = customerId || (data?.customerId ? String(data.customerId) : "");

  return (
    <EditableFormScreen
      title="Edit survey"
      subtitle={String(data?.number || "")}
      loading={isLoading}
      errorMessage={isError ? (error as { userMessage?: string })?.userMessage || "Failed" : undefined}
      onBack={() => router.replace((custId ? customerPath(custId, "surveys") : "/(tabs)/customers") as never)}
      onRetry={() => refetch()}
      initial={initial}
      fields={[
        { key: "projectType", label: "Project type" },
        { key: "date", label: "Survey date (YYYY-MM-DD)" },
        { key: "clientRequirements", label: "Client requirements", multiline: true },
        { key: "existingConditions", label: "Existing conditions", multiline: true },
        { key: "notes", label: "Notes", multiline: true },
      ]}
      onSave={async (form) => {
        await update.mutateAsync({
          id: String(id),
          body: {
            customerId: data?.customerId,
            siteId: data?.siteId || fromSite,
            projectType: form.projectType || "",
            date: form.date || null,
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
