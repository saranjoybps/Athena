import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { lightPalette as p, radius } from "@/lib/theme";

type Props = Omit<TextInputProps, "style"> & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children?: React.ReactNode;
};

/** Labelled input with the validation message directly under the field. Pass `children` to render a custom control instead of a TextInput. */
export function FormField({ label, required, error, hint, children, ...inputProps }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children ?? (
        <TextInput
          {...inputProps}
          style={[styles.input, inputProps.multiline ? styles.multiline : null, error ? styles.inputError : null]}
          placeholderTextColor={p.faint}
          accessibilityLabel={label}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: p.text,
  },
  inputError: { borderColor: p.red, backgroundColor: "#FFFBFB" },
});

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { color: p.text, fontWeight: "600", fontSize: 14, marginBottom: 6 },
  required: { color: p.red },
  input: fieldStyles.input,
  multiline: { minHeight: 84, textAlignVertical: "top" },
  inputError: fieldStyles.inputError,
  error: { color: p.red, fontSize: 12, fontWeight: "600", marginTop: 6 },
  hint: { color: p.muted, fontSize: 12, marginTop: 6 },
});
