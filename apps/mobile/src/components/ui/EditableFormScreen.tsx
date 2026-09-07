import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export type EditField = {
  key: string;
  label: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
};

type Props = {
  title: string;
  subtitle?: string;
  loading: boolean;
  errorMessage?: string;
  onBack: () => void;
  onRetry: () => void;
  initial: Record<string, string> | null;
  fields: EditField[];
  onSave: (form: Record<string, string>) => Promise<void>;
  lockedMessage?: string;
  canEdit?: boolean;
  children?: React.ReactNode;
};

export function EditableFormScreen({
  title,
  subtitle,
  loading,
  errorMessage,
  onBack,
  onRetry,
  initial,
  fields,
  onSave,
  lockedMessage,
  canEdit = true,
  children,
}: Props) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  async function save() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await onSave(form);
      Toast.show({ type: "success", text1: "Saved" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={title} subtitle={subtitle} onBack={onBack} />
        {loading ? <ActivityIndicator color={p.clay} /> : null}
        {errorMessage ? <ErrorBanner message={errorMessage} onRetry={onRetry} /> : null}
        {initial && canEdit ? (
          <View style={styles.card}>
            {fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={[styles.input, field.multiline && styles.multiline]}
                  value={form[field.key] || ""}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))}
                  multiline={field.multiline}
                  numberOfLines={field.multiline ? 3 : 1}
                  keyboardType={field.keyboardType || "default"}
                  placeholderTextColor={p.faint}
                />
              </View>
            ))}
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </View>
        ) : null}
        {initial && !canEdit && lockedMessage ? <Text style={styles.locked}>{lockedMessage}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 12,
  },
  field: { gap: 6 },
  label: { color: p.muted, fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: p.text,
    backgroundColor: p.background,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "700" },
  locked: { color: p.muted, marginBottom: spacing.md },
});
