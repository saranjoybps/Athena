import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateSurvey } from "@/hooks/useApi";
import { SurveyFormScreen, surveyBody } from "@/components/surveys/SurveyFormScreen";
import { todayIsoDate } from "@/components/ui/DateField";
import { customerPath, goBackOr, sitePath } from "@/lib/nav";
import { workTypeLabel } from "@/lib/workflow";

export default function NewSurvey() {
  const { siteId, customerId } = useLocalSearchParams<{ siteId?: string; customerId?: string }>();
  const router = useRouter();
  const create = useCreateSurvey();
  const fallback = siteId ? sitePath(siteId, { customerId, tab: "surveys" }) : customerId ? customerPath(customerId, "surveys") : "/(tabs)/customers";

  return (
    <SurveyFormScreen
      mode="create"
      initial={{
        customerId: customerId || "",
        siteId: siteId || "",
        projectType: "",
        date: todayIsoDate(),
        clientRequirements: "",
        existingConditions: "",
        notes: "",
      }}
      siteLocked={Boolean(siteId)}
      customerFixed={Boolean(customerId)}
      saving={create.isPending}
      onBack={() => goBackOr(router, fallback)}
      onAddSite={(cid) => router.push(`/(tabs)/sites/new?customerId=${cid}` as never)}
      onSubmit={async (values) => {
        try {
          const survey = await create.mutateAsync(surveyBody(values));
          Toast.show({
            type: "success",
            text1: `Survey ${String(survey.number || "")} saved`.replace("  ", " "),
            text2: `${workTypeLabel(values.projectType)} — next, measure the site.`,
          });
          goBackOr(router, sitePath(values.siteId, { customerId: values.customerId, tab: "surveys" }));
        } catch (e) {
          Toast.show({ type: "error", text1: "Couldn't save survey", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
        }
      }}
    />
  );
}
