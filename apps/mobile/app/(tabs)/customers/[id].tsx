import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import {
  useAddFollowUp,
  useCompleteFollowUp,
  useCustomerSummary,
  useUpdateCustomer,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/format";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Tab = "overview" | "pipeline" | "money" | "followups" | "details";

export default function CustomerHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const { data, isLoading, isError, error, refetch } = useCustomerSummary(id);
  const update = useUpdateCustomer();
  const addFollowUp = useAddFollowUp();
  const completeFollowUp = useCompleteFollowUp();

  const customer = (data?.customer || {}) as Record<string, unknown>;
  const money = (data?.money || {}) as Record<string, string>;
  const counts = (data?.counts || {}) as Record<string, number>;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const c = (data.customer || {}) as Record<string, unknown>;
    setName(String(c.name || ""));
    setPhone(String(c.phone || ""));
    setEmail(String(c.email || ""));
    setNotes(String(c.notes || ""));
  }, [data]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={p.clay} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Customer" onBack={() => router.back()} />
        <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  const sites = (data.sites as Record<string, unknown>[]) || [];
  const quotes = (data.quotes as Record<string, unknown>[]) || [];
  const projects = (data.projects as Record<string, unknown>[]) || [];
  const invoices = (data.invoices as Record<string, unknown>[]) || [];
  const payments = (data.payments as Record<string, unknown>[]) || [];
  const followUps = (data.followUps as Record<string, unknown>[]) || [];
  const estimates = (data.estimates as Record<string, unknown>[]) || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScreenHeader title={String(customer.name || "Customer")} onBack={() => router.back()} />
      <Text style={styles.sub}>{[customer.phone, customer.company].filter(Boolean).map(String).join(" · ")}</Text>

      <View style={styles.stats}>
        <Stat label="Due" value={formatCurrency(money.outstanding)} />
        <Stat label="In" value={formatCurrency(money.collected)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {(
          [
            ["overview", "Overview"],
            ["pipeline", "Pipeline"],
            ["money", "Money"],
            ["followups", `Follow-ups${counts.openFollowUps ? ` (${counts.openFollowUps})` : ""}`],
            ["details", "Details"],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabOn]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "overview" ? (
          <>
            <Text style={styles.section}>Sites</Text>
            {sites.length === 0 ? <EmptyState title="No sites" /> : null}
            {sites.map((s) => (
              <RecordCard
                key={String(s.id)}
                title={String(s.name || s.id)}
                subtitle={String(s.address || "")}
                onPress={() => router.push(`/(tabs)/sites/${s.id}` as never)}
              />
            ))}
            <Text style={styles.section}>Projects</Text>
            {projects.length === 0 ? <EmptyState title="No projects" /> : null}
            {projects.map((p) => (
              <RecordCard
                key={String(p.id)}
                title={String(p.name || p.number || p.id)}
                subtitle={formatCurrency(String(p.contractValue || "0"))}
                onPress={() => router.push(`/(tabs)/projects/${p.id}` as never)}
              />
            ))}
          </>
        ) : null}

        {tab === "pipeline" ? (
          <>
            <Text style={styles.section}>Estimates</Text>
            {estimates.map((e) => (
              <RecordCard
                key={String(e.id)}
                title={String(e.title || e.number || e.id)}
                onPress={() => router.push(`/(tabs)/estimates/${e.id}` as never)}
              />
            ))}
            <Text style={styles.section}>Quotes</Text>
            {quotes.map((q) => (
              <RecordCard
                key={String(q.id)}
                title={String(q.number || q.id)}
                subtitle={String(q.status || "")}
                onPress={() => router.push(`/(tabs)/quotes/${q.id}` as never)}
              />
            ))}
            <Text style={styles.section}>Projects</Text>
            {projects.map((p) => (
              <RecordCard
                key={String(p.id)}
                title={String(p.name || p.number || p.id)}
                onPress={() => router.push(`/(tabs)/projects/${p.id}` as never)}
              />
            ))}
          </>
        ) : null}

        {tab === "money" ? (
          <>
            <Text style={styles.section}>Invoices</Text>
            {invoices.length === 0 ? <EmptyState title="No invoices" /> : null}
            {invoices.map((i) => (
              <RecordCard
                key={String(i.id)}
                title={String(i.number || i.id)}
                subtitle={`${formatCurrency(String(i.total || i.total_amount || "0"))} · due ${formatCurrency(String(i.outstanding || "0"))}`}
                onPress={() => router.push(`/(tabs)/invoices/${i.id}` as never)}
              />
            ))}
            <Text style={styles.section}>Payments</Text>
            {payments.length === 0 ? <EmptyState title="No payments" /> : null}
            {payments.map((pay) => (
              <RecordCard
                key={String(pay.id)}
                title={`${formatCurrency(String(pay.amount || "0"))} · ${String(pay.method || "")}`}
                subtitle={formatDate(String(pay.createdAt || ""))}
              />
            ))}
          </>
        ) : null}

        {tab === "followups" ? (
          <>
            <View style={styles.form}>
              <Text style={styles.formTitle}>Add follow-up</Text>
              <TextInput
                style={[styles.input, { minHeight: 72 }]}
                multiline
                value={note}
                onChangeText={setNote}
                placeholder="Call, visit, send quote…"
                placeholderTextColor={p.faint}
              />
              <TextInput
                style={styles.input}
                value={dueAt}
                onChangeText={setDueAt}
                placeholder="Due YYYY-MM-DD"
                placeholderTextColor={p.faint}
              />
              <Pressable
                style={styles.btn}
                onPress={async () => {
                  if (!note.trim()) return;
                  try {
                    await addFollowUp.mutateAsync({ customerId: String(id), note, dueAt: dueAt || null });
                    setNote("");
                    setDueAt("");
                    Toast.show({ type: "success", text1: "Follow-up added" });
                    refetch();
                  } catch (e) {
                    Toast.show({ type: "error", text1: "Failed", text2: (e as { userMessage?: string })?.userMessage });
                  }
                }}
              >
                <Text style={styles.btnText}>Save</Text>
              </Pressable>
            </View>
            {followUps.length === 0 ? <EmptyState title="No open follow-ups" /> : null}
            {followUps.map((f) => (
              <View key={String(f.id)} style={styles.follow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.followNote}>{String(f.note)}</Text>
                  <Text style={styles.followMeta}>Due {formatDate(String(f.dueAt || ""))}</Text>
                </View>
                <Pressable
                  onPress={async () => {
                    await completeFollowUp.mutateAsync({ followUpId: String(f.id), customerId: String(id) });
                    refetch();
                  }}
                >
                  <Text style={{ color: p.clay, fontWeight: "700" }}>Done</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {tab === "details" ? (
          <View style={styles.form}>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes"
            />
            <Pressable
              style={styles.btn}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await update.mutateAsync({
                    id: String(id),
                    body: { name, phone, email: email || null, notes: notes || null },
                  });
                  Toast.show({ type: "success", text1: "Saved" });
                  refetch();
                } catch (e) {
                  Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save details"}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  sub: { color: p.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  stats: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  stat: { flex: 1, backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border },
  statLabel: { color: p.muted, fontSize: 11, textTransform: "uppercase" },
  statValue: { color: p.text, fontWeight: "700", marginTop: 4 },
  tabs: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.sm },
  tab: { backgroundColor: p.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: p.border },
  tabOn: { backgroundColor: p.clay, borderColor: p.clay },
  tabText: { color: p.text, fontWeight: "600", fontSize: 13 },
  tabTextOn: { color: "#fff" },
  content: { padding: spacing.lg, paddingBottom: 48 },
  section: { color: p.muted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: spacing.md, marginBottom: 8 },
  form: { backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: p.border, gap: 10 },
  formTitle: { fontWeight: "700", color: p.text },
  input: { borderWidth: 1, borderColor: p.border, borderRadius: 12, padding: 12, color: p.text, backgroundColor: p.background },
  btn: { backgroundColor: p.clay, borderRadius: 12, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  follow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 8,
    alignItems: "center",
  },
  followNote: { color: p.text, fontWeight: "600" },
  followMeta: { color: p.muted, fontSize: 12, marginTop: 2 },
});
