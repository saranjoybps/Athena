import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useSite, useUpdateSite } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { customerPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

/** Site details only — add survey / measurement / estimate from the customer hub. */
export default function SiteDetail() {
  const { id, customerId: customerParam } = useLocalSearchParams<{
    id: string;
    customerId?: string;
  }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSite(id);
  const update = useUpdateSite();
  const customerId = customerParam || (data?.customerId ? String(data.customerId) : "");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [siteType, setSiteType] = useState("");
  const [access, setAccess] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ""));
    setLocation(String(data.address || ""));
    setSiteType(String(data.siteType || ""));
    setAccess(String(data.accessInstructions || ""));
    setMapsUrl(String(data.mapsUrl || ""));
  }, [data]);

  async function saveDetails() {
    setBusy(true);
    try {
      await update.mutateAsync({
        id: String(id),
        body: {
          customerId: data?.customerId || customerId,
          name,
          address: location,
          siteType: siteType || null,
          accessInstructions: access || null,
          mapsUrl: mapsUrl || null,
        },
      });
      Toast.show({ type: "success", text1: "Site saved" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  const backHref = customerId ? customerPath(customerId, "sites") : "/(tabs)/customers";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={String(data?.name || "Site")}
          subtitle="Site details"
          onBack={() => router.replace(backHref as never)}
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {data ? (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Site location</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={location}
              onChangeText={setLocation}
              multiline
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Site type</Text>
            <TextInput style={styles.input} value={siteType} onChangeText={setSiteType} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Access</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={access}
              onChangeText={setAccess}
              multiline
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Maps URL</Text>
            <TextInput
              style={styles.input}
              value={mapsUrl}
              onChangeText={setMapsUrl}
              autoCapitalize="none"
              placeholderTextColor={p.faint}
            />
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={saveDetails} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save details"}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48 },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 8,
  },
  label: { color: p.muted, fontWeight: "600", marginTop: 4 },
  input: {
    backgroundColor: p.background,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: p.text,
  },
  multi: { minHeight: 72, textAlignVertical: "top" },
  btn: { marginTop: 12, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
