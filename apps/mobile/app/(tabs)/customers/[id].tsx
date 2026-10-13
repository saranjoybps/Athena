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
import { MapPin, Plus } from "lucide-react-native";
import {
  useAddFollowUp,
  useCachedCustomer,
  useCompleteFollowUp,
  useCustomerSummary,
  useUpdateCustomer,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { RecordCard } from "@/components/ui/RecordCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { measurementSummary, parseCustomerTab, sitePath, type CustomerTab } from "@/lib/nav";
import { DateField, todayIsoDate } from "@/components/ui/DateField";
import { cardShadow, lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

export default function CustomerHub() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const tabFromUrl = parseCustomerTab(tabParam) || "overview";
  const [tab, setTab] = useState<CustomerTab>(tabFromUrl);
  const { data, isLoading, isError, error, refetch } = useCustomerSummary(id);
  const cachedCustomer = useCachedCustomer(id);
  const update = useUpdateCustomer();
  const addFollowUp = useAddFollowUp();
  const completeFollowUp = useCompleteFollowUp();

  const customer = (data?.customer || {}) as Record<string, unknown>;
  const money = (data?.money || {}) as Record<string, string>;
  const counts = (data?.counts || {}) as Record<string, number>;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState(todayIsoDate());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (!data) return;
    const c = (data.customer || {}) as Record<string, unknown>;
    setName(String(c.name || ""));
    setPhone(String(c.phone || ""));
    setAlternatePhone(String(c.alternatePhone || ""));
    setEmail(String(c.email || ""));
    setCompany(String(c.company || ""));
    setAddress(String(c.address || ""));
    setBillingAddress(String(c.billingAddress || ""));
    setGstin(String(c.gstin || ""));
    setPan(String(c.pan || ""));
    setNotes(String(c.notes || ""));
  }, [data]);

  function goTab(next: CustomerTab) {
    if (next === tab) return;
    setTab(next);
    router.setParams({ tab: next });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.pad}>
          <ScreenHeader
            title={String(cachedCustomer?.name || "Customer")}
            subtitle={[cachedCustomer?.phone, cachedCustomer?.company].filter(Boolean).map(String).join(" · ") || undefined}
            onBack={() => router.replace("/(tabs)/customers" as never)}
          />
        </View>
        <ActivityIndicator color={p.clay} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pad}>
          <ScreenHeader title="Customer" onBack={() => router.replace("/(tabs)/customers" as never)} />
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const sites = (data.sites as Record<string, unknown>[]) || [];
  const projects = (data.projects as Record<string, unknown>[]) || [];
  const invoices = (data.invoices as Record<string, unknown>[]) || [];
  const payments = (data.payments as Record<string, unknown>[]) || [];
  const followUps = (data.followUps as Record<string, unknown>[]) || [];
  const estimates = (data.estimates as Record<string, unknown>[]) || [];
  const surveys = (data.surveys as Record<string, unknown>[]) || [];
  const measurements = (data.measurements as Record<string, unknown>[]) || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.pad}>
        <ScreenHeader
          title={String(customer.name || "Customer")}
          subtitle={
            [customer.phone, customer.company].filter(Boolean).map(String).join(" · ") ||
            "Open a site to continue"
          }
          onBack={() => router.replace("/(tabs)/customers" as never)}
        />
      </View>

      <View style={styles.moneyStrip}>
        <MoneyCell label="Due" value={formatCurrency(money.outstanding)} emphasize />
        <View style={styles.moneySep} />
        <MoneyCell label="Collected" value={formatCurrency(money.collected)} />
        <View style={styles.moneySep} />
        <MoneyCell label="Billed" value={formatCurrency(money.billed)} />
      </View>

      <SegmentTabs
        value={tab}
        onChange={goTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "sites", label: `Sites (${counts.sites ?? sites.length})` },
          { key: "surveys", label: `Surveys (${counts.surveys ?? surveys.length})` },
          { key: "measurements", label: `Measurements (${counts.measurements ?? measurements.length})` },
          { key: "estimates", label: `Estimates (${counts.estimates ?? estimates.length})` },
          { key: "money", label: "Money" },
          { key: "followups", label: `Follow-ups${counts.openFollowUps ? ` (${counts.openFollowUps})` : ""}` },
          { key: "details", label: "Details" },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "overview" ? (
          <>
            <Text style={styles.section}>Sites</Text>
            {sites.length === 0 ? (
              <EmptyState
                title="No sites"
                subtitle="Add a site to start survey → measurement → estimate."
                actionLabel="Add site"
                onAction={() => router.push(`/(tabs)/sites/new?customerId=${id}` as never)}
              />
            ) : null}
            {sites.map((s) => (
              <RecordCard
                key={String(s.id)}
                title={String(s.name || s.id)}
                subtitle={String(s.address || "")}
                leading={<MapPin size={18} color={p.clay} strokeWidth={2.4} />}
                onPress={() => router.push(sitePath(String(s.id), { customerId: id }) as never)}
              />
            ))}
            <Text style={styles.section}>Projects</Text>
            {projects.length === 0 ? <EmptyState title="No projects" /> : null}
            {projects.map((proj) => (
              <RecordCard
                key={String(proj.id)}
                title={String(proj.name || proj.number || proj.id)}
                subtitle={formatCurrency(String(proj.contractValue || "0"))}
                onPress={() => router.push(`/(tabs)/projects/${proj.id}` as never)}
              />
            ))}
          </>
        ) : null}

        {tab === "sites" ? (
          <>
            <PrimaryButton
              label="Add site"
              onPress={() => router.push(`/(tabs)/sites/new?customerId=${id}` as never)}
            />
            {sites.length === 0 ? <EmptyState title="No sites yet" /> : null}
            {sites.map((s) => (
              <RecordCard
                key={String(s.id)}
                title={String(s.name || s.id)}
                subtitle={String(s.address || "")}
                leading={<MapPin size={18} color={p.clay} strokeWidth={2.4} />}
                onPress={() => router.push(sitePath(String(s.id), { customerId: id }) as never)}
              />
            ))}
          </>
        ) : null}

        {tab === "surveys" ? (
          <>
            <PrimaryButton
              label="Add survey"
              onPress={() => router.push(`/(tabs)/surveys/new?customerId=${id}` as never)}
            />
            {surveys.length === 0 ? <EmptyState title="No surveys" subtitle="Add a survey for a site." /> : null}
            {surveys.map((s) => (
              <RecordCard
                key={String(s.id)}
                title={String(s.number || s.id)}
                subtitle={String(s.notes || s.projectType || "")}
                onPress={() =>
                  router.push(`/(tabs)/surveys/${s.id}?fromSite=${s.siteId || ""}&customerId=${id}` as never)
                }
              />
            ))}
          </>
        ) : null}

        {tab === "measurements" ? (
          <>
            <PrimaryButton
              label="Add measurement"
              onPress={() => router.push(`/(tabs)/measurements/new?customerId=${id}` as never)}
            />
            {measurements.length === 0 ? (
              <EmptyState title="No measurements" subtitle="Capture quantities for a site." />
            ) : null}
            {measurements.map((m) => (
              <RecordCard
                key={String(m.id)}
                title={String(m.formulaKind || m.id)}
                subtitle={measurementSummary(m)}
                onPress={() =>
                  router.push(
                    `/(tabs)/measurements/${m.id}?fromSite=${m.siteId || ""}&customerId=${id}` as never,
                  )
                }
              />
            ))}
          </>
        ) : null}

        {tab === "estimates" ? (
          <>
            <PrimaryButton
              label="Add estimate"
              onPress={() => router.push(`/(tabs)/estimates/new?customerId=${id}` as never)}
            />
            {estimates.length === 0 ? <EmptyState title="No estimates" /> : null}
            {estimates.map((e) => (
              <RecordCard
                key={String(e.id)}
                title={String(e.title || e.number || e.id)}
                subtitle={formatCurrency(
                  String((e.computed as { grandTotal?: string })?.grandTotal || e.total || "0"),
                )}
                onPress={() =>
                  router.push(
                    `/(tabs)/estimates/${e.id}?fromSite=${e.siteId || ""}&customerId=${id}` as never,
                  )
                }
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
                placeholder="Call, visit, send estimate…"
                placeholderTextColor={p.faint}
              />
              <DateField label="Due date" value={dueAt} onChange={setDueAt} />
              <PrimaryButton
                label="Save"
                onPress={async () => {
                  if (!note.trim()) {
                    Toast.show({ type: "error", text1: "Note required" });
                    return;
                  }
                  try {
                    await addFollowUp.mutateAsync({
                      customerId: String(id),
                      note: note.trim(),
                      dueAt: dueAt || null,
                    });
                    setNote("");
                    setDueAt(todayIsoDate());
                    Toast.show({ type: "success", text1: "Follow-up added" });
                  } catch (e) {
                    Toast.show({
                      type: "error",
                      text1: "Failed",
                      text2: (e as { userMessage?: string })?.userMessage,
                    });
                  }
                }}
              />
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
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={p.faint} />
            <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="Company" placeholderTextColor={p.faint} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              keyboardType="phone-pad"
              placeholderTextColor={p.faint}
            />
            <TextInput
              style={styles.input}
              value={alternatePhone}
              onChangeText={setAlternatePhone}
              placeholder="Alternate phone"
              keyboardType="phone-pad"
              placeholderTextColor={p.faint}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              placeholderTextColor={p.faint}
            />
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              multiline
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              placeholderTextColor={p.faint}
            />
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              multiline
              value={billingAddress}
              onChangeText={setBillingAddress}
              placeholder="Billing address"
              placeholderTextColor={p.faint}
            />
            <TextInput style={styles.input} value={gstin} onChangeText={setGstin} placeholder="GSTIN" autoCapitalize="characters" placeholderTextColor={p.faint} />
            <TextInput style={styles.input} value={pan} onChangeText={setPan} placeholder="PAN" autoCapitalize="characters" placeholderTextColor={p.faint} />
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes"
              placeholderTextColor={p.faint}
            />
            <PrimaryButton
              label={busy ? "Saving…" : "Save details"}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await update.mutateAsync({
                    id: String(id),
                    body: {
                      name,
                      company: company || null,
                      phone,
                      alternatePhone: alternatePhone || null,
                      email: email || null,
                      address: address || null,
                      billingAddress: billingAddress || null,
                      gstin: gstin || null,
                      pan: pan || null,
                      notes: notes || null,
                    },
                  });
                  Toast.show({ type: "success", text1: "Saved" });
                } catch (e) {
                  Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyCell({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.moneyCell}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, emphasize && { color: p.clayDark }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Plus size={16} color="#fff" strokeWidth={2.5} />
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  moneyStrip: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    flexDirection: "row",
    paddingVertical: 14,
    ...cardShadow,
  },
  moneyCell: { flex: 1, paddingHorizontal: 10, alignItems: "center" },
  moneySep: { width: 1, backgroundColor: p.border },
  moneyLabel: { color: p.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },
  moneyValue: { color: p.text, fontWeight: "800", marginTop: 4, fontSize: 14 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  section: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: 10,
  },
  hint: { color: p.muted, fontSize: 13, marginBottom: spacing.sm, lineHeight: 18 },
  form: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 10,
    ...cardShadow,
  },
  formTitle: { fontWeight: "700", color: p.text },
  input: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    padding: 12,
    color: p.text,
    backgroundColor: p.background,
  },
  primaryBtn: {
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
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
