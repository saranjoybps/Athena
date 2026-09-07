"use client";

import { useSearchParams } from "next/navigation";
import { RecordFormPage } from "@/components/record-form";
import { athena, optionsFrom } from "@/lib/athena-client";

export default function Page() {
  const search = useSearchParams();
  const customerId = search.get("customerId") || "";

  return (
    <RecordFormPage
      title="New site"
      subtitle="Job location linked to a customer."
      backHref={customerId ? `/app/customers/${customerId}` : "/app/sites"}
      backLabel={customerId ? "Customer" : "Sites"}
      successHref={(r) => (r?.id ? `/app/sites/${r.id}` : "/app/sites")}
      fields={[
        {
          key: "customerId",
          label: "Customer",
          type: "relation",
          required: true,
          defaultValue: customerId,
          loadOptions: () => optionsFrom(athena.customers.list),
        },
        { key: "name", label: "Site name", required: true },
        { key: "address", label: "Address", type: "textarea", required: true },
        { key: "pinCode", label: "PIN code" },
        { key: "siteType", label: "Site type", placeholder: "residential / commercial" },
        { key: "contactName", label: "Contact name" },
        { key: "phone", label: "Phone" },
        { key: "accessInstructions", label: "Access instructions", type: "textarea" },
      ]}
      onSubmit={(form) =>
        athena.sites.create({
          customerId: form.customerId,
          name: form.name,
          address: form.address,
          pinCode: form.pinCode || null,
          siteType: form.siteType || null,
          contactName: form.contactName || null,
          phone: form.phone || null,
          accessInstructions: form.accessInstructions || null,
        }) as Promise<{ id?: string }>
      }
    />
  );
}
