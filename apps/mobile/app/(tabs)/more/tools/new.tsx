import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateTool } from "@/hooks/useApi";
import { ToolFormScreen, toolBody } from "@/components/inventory/ToolFormScreen";

export default function NewTool() {
  const router = useRouter();
  const create = useCreateTool();

  return (
    <ToolFormScreen
      mode="create"
      saving={create.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await create.mutateAsync(toolBody(values));
          Toast.show({ type: "success", text1: "Tool added", text2: `${values.name.trim()} was added to your tools.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't add tool",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
