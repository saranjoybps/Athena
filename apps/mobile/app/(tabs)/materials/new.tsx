import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateMaterial } from "@/hooks/useApi";
import { MaterialFormScreen, materialBody } from "@/components/inventory/MaterialFormScreen";

export default function NewMaterial() {
  const router = useRouter();
  const create = useCreateMaterial();

  return (
    <MaterialFormScreen
      mode="create"
      saving={create.isPending}
      onBack={() => router.back()}
      onSubmit={async (values) => {
        try {
          await create.mutateAsync(materialBody(values));
          Toast.show({ type: "success", text1: "Material added", text2: `${values.name.trim()} is now in your catalog.` });
          router.back();
        } catch (e) {
          Toast.show({
            type: "error",
            text1: "Couldn't add material",
            text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
          });
        }
      }}
    />
  );
}
