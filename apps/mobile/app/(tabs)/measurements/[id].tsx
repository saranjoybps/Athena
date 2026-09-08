import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useMeasurement, useUpdateMeasurement } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MeasurementEditor } from "@/components/ui/MeasurementEditor";
import {
  buildMeasurementPayload,
  MeasurementItem,
  parseMeasurementItems,
  primaryQuantity,
} from "@/lib/measurements";
import { entityBackPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export default function MeasurementDetail() {
  const { id, customerId, fromSite } = useLocalSearchParams<{
    id: string;
    customerId?: string;
    fromSite?: string;
  }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useMeasurement(id);
  const update = useUpdateMeasurement();
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const siteId = fromSite || (data?.siteId ? String(data.siteId) : "");
  const custId = customerId || (data?.customerId ? String(data.customerId) : "");
  const backHref = entityBackPath({
    customerId: custId,
    tab: "measurements",
    siteId: null,
    siteTab: "measurements",
  });

  useEffect(() => {
    if (!data || hydrated) return;
    setItems(parseMeasurementItems(data as Record<string, unknown>));
    setNotes(String(data.notes || ""));
    setHydrated(true);
  }, [data, hydrated]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + primaryQuantity(item.outputs), 0),
    [items],
  );

  async function save() {
    if (!items.length) {
      Toast.show({ type: "error", text1: "Add at least one line" });
      return;
    }
    setBusy(true);
    try {
      const payload = buildMeasurementPayload(items, notes || null);
      await update.mutateAsync({ id: String(id), body: payload });
      Toast.show({ type: "success", text1: "Measurement saved" });
      setHydrated(false);
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Measurement"
          subtitle={total ? `≈ ${total} sqft` : String(data?.formulaKind || "")}
          onBack={() => router.replace(backHref as never)}
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {data && hydrated ? (
          <>
            <MeasurementEditor items={items} onChange={setItems} />
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={p.faint}
            />
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.sm },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
