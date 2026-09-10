import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMaterial, useUpdateMaterial } from "@/hooks/useApi";
import { EditableFormScreen } from "@/components/ui/EditableFormScreen";

export default function MaterialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useMaterial(id);
  const update = useUpdateMaterial();

  const initial = useMemo(
    () =>
      data
        ? {
            name: String(data.name || ""),
            unit: String(data.unit || "pcs"),
            brand: String(data.brand || ""),
            category: String(data.category || ""),
            defaultPurchasePrice: String(data.defaultPurchasePrice || ""),
            defaultSellingPrice: String(data.defaultSellingPrice || ""),
            minimumStock: String(data.minimumStock || ""),
            hsn: String(data.hsn || ""),
            gstRate: String(data.gstRate ?? "0.18"),
          }
        : null,
    [data],
  );

  return (
    <EditableFormScreen
      title="Edit material"
      subtitle={String(data?.name || "")}
      loading={isLoading}
      errorMessage={isError ? (error as { userMessage?: string })?.userMessage || "Failed" : undefined}
      onBack={() => router.back()}
      onRetry={() => refetch()}
      initial={initial}
      fields={[
        { key: "name", label: "Name" },
        { key: "unit", label: "Unit" },
        { key: "brand", label: "Brand" },
        { key: "category", label: "Category" },
        { key: "defaultPurchasePrice", label: "Purchase price", keyboardType: "numeric" },
        { key: "defaultSellingPrice", label: "Selling price", keyboardType: "numeric" },
        { key: "minimumStock", label: "Minimum stock", keyboardType: "numeric" },
        { key: "hsn", label: "HSN code" },
        { key: "gstRate", label: "GST rate (e.g. 0.18)", keyboardType: "numeric" },
      ]}
      onSave={async (form) => {
        await update.mutateAsync({
          id: String(id),
          body: {
            name: form.name,
            unit: form.unit || "pcs",
            brand: form.brand || null,
            category: form.category || null,
            defaultPurchasePrice: form.defaultPurchasePrice || null,
            defaultSellingPrice: form.defaultSellingPrice || null,
            minimumStock: form.minimumStock || null,
            hsn: form.hsn || null,
            gstRate: form.gstRate ? Number(form.gstRate) : 0.18,
          },
        });
        refetch();
      }}
    />
  );
}
