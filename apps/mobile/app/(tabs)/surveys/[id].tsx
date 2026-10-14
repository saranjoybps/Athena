import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useDeleteSurvey, useSurvey, useUpdateSurvey } from "@/hooks/useApi";
import { SurveyFormScreen, surveyBody, surveyValuesFrom } from "@/components/surveys/SurveyFormScreen";
import { showDeleteError } from "@/lib/confirm";
import { goBackOr, sitePath } from "@/lib/nav";

export default function SurveyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const surveyQ = useSurvey(id);
  const update = useUpdateSurvey();
  const del = useDeleteSurvey();
  const survey = surveyQ.data;
  const fallback = survey?.siteId ? sitePath(String(survey.siteId), { customerId: String(survey.customerId || ""), tab: "surveys" }) : "/(tabs)/customers";

  return (
    <SurveyFormScreen
      key={survey ? "ready" : "loading"}
      mode="edit"
      number={survey?.number ? String(survey.number) : undefined}
      initial={survey ? surveyValuesFrom(survey) : null}
      siteLocked
      loading={surveyQ.isLoading}
      loadError={surveyQ.isError ? (surveyQ.error as { userMessage?: string })?.userMessage || "Couldn't load survey." : undefined}
      onRetry={() => surveyQ.refetch()}
      saving={update.isPending}
      deleting={del.isPending}
      onBack={() => goBackOr(router, fallback)}
      onSubmit={async (values) => {
        try {
          await update.mutateAsync({ id: String(id), body: surveyBody(values) });
          Toast.show({ type: "success", text1: "Survey updated", text2: survey?.number ? String(survey.number) : undefined });
          goBackOr(router, fallback);
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save survey", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
      onDelete={async () => {
        try {
          await del.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Survey deleted" });
          goBackOr(router, fallback);
        } catch (e) {
          showDeleteError("survey", e);
        }
      }}
    />
  );
}
