import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useCreateSurvey, useMeasurements, useSite, useSurveys, useUpdateSite } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Tab = "details" | "surveys" | "measurements";

export default function SiteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("details");
  const { data, isLoading, isError, error, refetch } = useSite(id);
  const update = useUpdateSite();
  const surveys = useSurveys(id);
  const measurements = useMeasurements(id);
  const createSurvey = useCreateSurvey();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [surveyNotes, setSurveyNotes] = useState("");

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ""));
    setAddress(String(data.address || ""));
    setPinCode(String(data.pinCode || ""));
    setPhone(String(data.phone || ""));
    setAccess(String(data.accessInstructions || ""));
  }, [data]);

  async function saveDetails() {
    setBusy(true);
    try {
      await update.mutateAsync({
        id: String(id),
        body: {
          customerId: data?.customerId,
          name,
          address,
          pinCode: pinCode || null,
          phone: phone || null,
          accessInstructions: access || null,
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

  async function addQuickSurvey() {
    if (!data?.customerId) {
      Toast.show({ type: "error", text1: "Site missing customer" });
      return;
    }
    try {
      await createSurvey.mutateAsync({
        customerId: data.customerId,
        siteId: id,
        projectType: "painting",
        notes: surveyNotes || null,
      });
      setSurveyNotes("");
      Toast.show({ type: "success", text1: "Survey added" });
      surveys.refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const surveyItems = surveys.data?.items ?? [];
  const measurementItems = measurements.data?.items ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={String(data?.name || "Site")} subtitle="Location hub" onBack={() => router.back()} />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} /> : null}

        <View style={styles.tabs}>
          {(
            [
              ["details", "Details"],
              ["surveys", `Surveys (${surveyItems.length})`],
              ["measurements", `Measures (${measurementItems.length})`],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "details" && data ? (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Address</Text>
            <TextInput style={[styles.input, styles.multi]} value={address} onChangeText={setAddress} multiline placeholderTextColor={p.faint} />
            <Text style={styles.label}>PIN</Text>
            <TextInput style={styles.input} value={pinCode} onChangeText={setPinCode} keyboardType="number-pad" placeholderTextColor={p.faint} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={p.faint} />
            <Text style={styles.label}>Access</Text>
            <TextInput style={[styles.input, styles.multi]} value={access} onChangeText={setAccess} multiline placeholderTextColor={p.faint} />
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={saveDetails} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save details"}</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "surveys" ? (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={styles.label}>Quick survey notes</Text>
              <TextInput
                style={[styles.input, styles.multi]}
                value={surveyNotes}
                onChangeText={setSurveyNotes}
                placeholder="What did you see on site?"
                placeholderTextColor={p.faint}
                multiline
              />
              <Pressable style={styles.btn} onPress={addQuickSurvey} disabled={createSurvey.isPending}>
                <Text style={styles.btnText}>{createSurvey.isPending ? "Saving…" : "Add survey"}</Text>
              </Pressable>
            </View>
            {surveyItems.length === 0 ? <EmptyState title="No surveys yet" subtitle="Add notes from this site visit." /> : null}
            {surveyItems.map((item) => (
              <RecordCard
                key={item.id}
                title={String(item.number || item.id)}
                subtitle={String(item.notes || item.scope || item.projectType || "")}
                meta={formatDate(item.createdAt ? String(item.createdAt) : null)}
                onPress={() => router.push(`/(tabs)/surveys/${item.id}`)}
              />
            ))}
          </View>
        ) : null}

        {tab === "measurements" ? (
          <View style={{ gap: 12 }}>
            <Pressable style={styles.btn} onPress={() => router.push(`/(tabs)/measurements/new?siteId=${id}`)}>
              <Text style={styles.btnText}>Add measurement</Text>
            </Pressable>
            {measurementItems.length === 0 ? (
              <EmptyState title="No measurements" subtitle="Capture quantities for this site." />
            ) : null}
            {measurementItems.map((item) => (
              <RecordCard
                key={item.id}
                title={String(item.formulaKind || item.id)}
                subtitle={String(item.notes || JSON.stringify(item.outputs || {}))}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  tabOn: { backgroundColor: p.clay, borderColor: p.clay },
  tabText: { color: p.muted, fontSize: 12, fontWeight: "700" },
  tabTextOn: { color: "#fff" },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, gap: 8 },
  label: { color: p.muted, fontSize: 13, fontWeight: "600", marginTop: 4 },
  input: { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: p.text, backgroundColor: p.background },
  multi: { minHeight: 80, textAlignVertical: "top" },
  btn: { backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "700" },
});
