import { View } from "react-native";
import { FormField } from "@/components/ui/FormField";
import { SelectDropdown, type SelectOption } from "@/components/ui/SelectDropdown";

/**
 * A dropdown whose "Other" option opens a text box. The stored value is the option id, or the typed text
 * when "Other" is chosen ("other" alone means Other was picked but nothing typed yet).
 */
export function OptionOrOtherField({
  label,
  options,
  value,
  onChange,
  required,
  error,
  placeholder,
  otherLabel,
  otherPlaceholder,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  placeholder: string;
  otherLabel: string;
  otherPlaceholder: string;
}) {
  const known = options.some((o) => o.id === value && o.id !== "other");
  const isOther = Boolean(value) && !known;
  const selected = known ? value : isOther ? "other" : "";
  const typed = isOther && value !== "other" ? value : "";
  const otherError = error && isOther ? error : undefined;

  return (
    <View>
      <FormField label={label} required={required} error={isOther ? undefined : error}>
        <SelectDropdown options={options} value={selected} onChange={(v) => onChange(v)} placeholder={placeholder} error={isOther ? undefined : error} />
      </FormField>
      {isOther ? (
        <FormField
          label={otherLabel}
          required={required}
          value={typed}
          onChangeText={(t) => onChange(t.trim() ? t : "other")}
          error={otherError}
          placeholder={otherPlaceholder}
          autoFocus={!typed}
        />
      ) : null}
    </View>
  );
}

/** True when "Other" was chosen but nothing typed. */
export function otherIsBlank(value: string) {
  return value === "other";
}
