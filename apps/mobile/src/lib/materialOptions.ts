import type { SelectOption } from "@/components/ui/SelectDropdown";
import { formatCurrency } from "@/lib/format";

export function materialSelectOptions(
  materials: Array<{ id: string; name: string; unit?: string; selling?: string }>,
): SelectOption[] {
  return materials.map((m) => ({
    id: m.id,
    label: m.name,
    detail:
      [m.selling ? formatCurrency(m.selling) : "", m.unit ? `per ${m.unit}` : ""].filter(Boolean).join(" ") ||
      undefined,
  }));
}
