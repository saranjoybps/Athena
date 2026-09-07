import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSupplier, useUpdateSupplier } from "@/hooks/useApi";
import { EditableFormScreen } from "@/components/ui/EditableFormScreen";

export default function SupplierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSupplier(id);
  const update = useUpdateSupplier();
  const initial = useMemo(
    () =>
      data
        ? {
            name: String(data.name || ""),
            phone: String(data.phone || ""),
            company: String(data.company || ""),
            email: String(data.email || ""),
            address: String(data.address || ""),
            gstin: String(data.gstin || ""),
          }
        : null,
    [data],
  );

  return (
    <EditableFormScreen
      title="Edit supplier"
      subtitle={String(data?.name || "")}
      loading={isLoading}
      errorMessage={isError ? (error as { userMessage?: string })?.userMessage || "Failed" : undefined}
      onBack={() => router.back()}
      onRetry={() => refetch()}
      initial={initial}
      fields={[
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone", keyboardType: "phone-pad" },
        { key: "company", label: "Company" },
        { key: "email", label: "Email", keyboardType: "email-address" },
        { key: "address", label: "Address", multiline: true },
        { key: "gstin", label: "GSTIN" },
      ]}
      onSave={async (form) => {
        await update.mutateAsync({
          id: String(id),
          body: {
            name: form.name,
            phone: form.phone || null,
            company: form.company || null,
            email: form.email || null,
            address: form.address || null,
            gstin: form.gstin || null,
          },
        });
        refetch();
      }}
    />
  );
}
