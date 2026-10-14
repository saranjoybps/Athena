import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ArrowRight, Images, MapPin, Navigation, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react-native";
import { useCustomerSummary, useDeleteSite, useSite, useSiteFiles } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { DirectionsButton } from "@/components/ui/DirectionsButton";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentTabs } from "@/components/ui/SegmentTabs";
import { EstimateRow, MeasurementRow, SurveyRow } from "@/components/customers/WorkflowRows";
import { useEstimateDrawer } from "@/components/estimates/EstimateDrawer";
import { SiteFilesDrawer } from "@/components/sites/SiteFilesDrawer";
import { confirmDestructive, describeCounts, showDeleteError } from "@/lib/confirm";
import { customerDisplayName } from "@/lib/customers";
import { customerPath, goBackOr, parseSiteTab, type SiteTab } from "@/lib/nav";
import { siteTypeLabel } from "@/lib/workflow";
import { cardShadow, lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Row = Record<string, unknown>;

export default function SiteDetail() {
  const { id, customerId: customerParam, tab: tabParam } = useLocalSearchParams<{ id: string; customerId?: string; tab?: string }>();
  const router = useRouter();
  const siteQ = useSite(id);
  const site = siteQ.data;
  const customerId = customerParam || (site?.customerId ? String(site.customerId) : "");
  const summaryQ = useCustomerSummary(customerId || undefined);
  const filesQ = useSiteFiles(id ? String(id) : undefined);
  const del = useDeleteSite();
  const [tab, setTab] = useState<SiteTab>(parseSiteTab(tabParam) || "surveys");
  const [filesOpen, setFilesOpen] = useState(false);
  const customer = (summaryQ.data?.customer || {}) as Row;
  const drawer = useEstimateDrawer({ phone: customer.phone as string, email: customer.email as string });

  useEffect(() => {
    const t = parseSiteTab(tabParam);
    if (t) setTab(t);
  }, [tabParam]);

  const forSite = (rows: unknown) => ((rows as Row[]) || []).filter((r) => String(r.siteId || "") === String(id));
  const surveys = useMemo(() => forSite(summaryQ.data?.surveys), [summaryQ.data, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const measurements = useMemo(() => forSite(summaryQ.data?.measurements), [summaryQ.data, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const estimates = useMemo(() => forSite(summaryQ.data?.estimates), [summaryQ.data, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileCount = filesQ.data?.items?.length ?? 0;
  const back = () => goBackOr(router, customerId ? customerPath(customerId, "sites") : "/(tabs)/customers");

  function create(kind: "surveys" | "measurements" | "estimates") {
    router.push(`/(tabs)/${kind}/new?siteId=${id}&customerId=${customerId}` as never);
  }

  function confirmDelete() {
    const related = describeCounts({ surveys: surveys.length, measurements: measurements.length, estimates: estimates.length, files: fileCount });
    confirmDestructive({
      entity: "site",
      name: site?.name ? `"${String(site.name)}"` : undefined,
      message: `This site${related ? ` and its ${related}` : ""} will be permanently deleted. This can't be undone.`,
      onConfirm: async () => {
        try {
          await del.mutateAsync(String(id));
          Toast.show({ type: "success", text1: "Site deleted", text2: String(site?.name || "") || undefined });
          back();
        } catch (e) {
          showDeleteError("site", e);
        }
      },
    });
  }

  if (siteQ.isError && !site) {
    const gone = (siteQ.error as { response?: { status?: number } })?.response?.status === 404;
    return (
      <SoftBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.pad}>
            <ScreenHeader title="Site" onBack={back} />
            {gone ? (
              <EmptyState title="This site was deleted" subtitle="It's no longer available." actionLabel="Go back" onAction={back} />
            ) : (
              <ErrorBanner message={(siteQ.error as { userMessage?: string })?.userMessage || "Couldn't load site."} onRetry={() => siteQ.refetch()} />
            )}
          </View>
        </SafeAreaView>
      </SoftBackground>
    );
  }

  if (!site) {
    return (
      <SoftBackground>
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={styles.pad}>
            <ScreenHeader title="Site" onBack={back} />
          </View>
          <ActivityIndicator color={p.clay} style={{ marginTop: 40 }} />
        </SafeAreaView>
      </SoftBackground>
    );
  }

  const address = [site.address, site.pinCode].filter(Boolean).map(String).join(" — ");
  const mapsUrl =
    site.lat != null && site.lng != null && site.lat !== ""
      ? `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`
      : String(site.mapsUrl || "") || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");
  const phone = String(customer.phone || "");

  const approved = estimates.find((e) => e.status === "approved" && !e.projectId);
  const openEstimate = estimates.find((e) => e.status === "draft" || e.status === "changes_requested");
  const next = approved
    ? { title: `Start the project for ${String(approved.number || "the approved estimate")}`, run: () => drawer.open(String(approved.id)) }
    : openEstimate
      ? { title: `${openEstimate.status === "draft" ? "Send" : "Revise"} ${String(openEstimate.number || "the estimate")}`, run: () => drawer.open(String(openEstimate.id)) }
      : !surveys.length && !measurements.length && !estimates.length
        ? { title: "Record a site survey", detail: "Requirements and current condition.", run: () => create("surveys") }
        : !measurements.length && !estimates.length
          ? { title: "Measure the site", detail: "Rooms, walls, ceilings and openings.", run: () => create("measurements") }
          : !estimates.length
            ? { title: "Prepare the estimate", detail: "Measured quantities are ready to price.", run: () => create("estimates") }
            : null;

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={siteQ.isRefetching || summaryQ.isRefetching}
              onRefresh={() => {
                siteQ.refetch();
                summaryQ.refetch();
                filesQ.refetch();
              }}
              tintColor={p.clay}
            />
          }
        >
          <ScreenHeader
            title="Site"
            onBack={back}
            right={
              <Pressable style={styles.headerBtn} onPress={() => router.push(`/(tabs)/sites/${id}/edit` as never)} accessibilityLabel="Edit site">
                <Pencil size={18} color={p.text} strokeWidth={2.3} />
              </Pressable>
            }
          />

          <View style={styles.info}>
            <View style={styles.infoTop}>
              <View style={styles.pin}>
                <MapPin size={22} color={p.clay} strokeWidth={2.3} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{String(site.name || "Site")}</Text>
                {site.siteType ? <Text style={styles.type}>{siteTypeLabel(site.siteType)}</Text> : null}
              </View>
              <DirectionsButton place={site} label={String(site.name || "site")} size={40} />
            </View>
            {address ? <Text style={styles.address}>{address}</Text> : null}
            {site.accessInstructions ? <Text style={styles.access}>Access: {String(site.accessInstructions)}</Text> : null}
            {customerId ? (
              <Pressable style={styles.customer} onPress={() => router.push(customerPath(customerId) as never)}>
                <UserRound size={16} color={p.muted} />
                <Text style={styles.customerText} numberOfLines={1}>
                  {summaryQ.data ? customerDisplayName(customer) : "Customer"}
                </Text>
                <ArrowRight size={14} color={p.faint} />
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Action
                label="Directions"
                disabled={!mapsUrl}
                onPress={() => Linking.openURL(mapsUrl).catch(() => Toast.show({ type: "error", text1: "Couldn't open maps" }))}
                icon={<Navigation size={18} color={p.blue} />}
              />
              <Action label={fileCount ? `Files · ${fileCount}` : "Files"} onPress={() => setFilesOpen(true)} icon={<Images size={18} color={p.purple} />} />
              <Action label="Call" disabled={!phone} onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)} icon={<Phone size={18} color={p.clayDark} />} />
            </View>
          </View>

          {next ? (
            <Pressable style={styles.next} onPress={next.run}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextLabel}>Next step</Text>
                <Text style={styles.nextTitle}>{next.title}</Text>
                {"detail" in next && next.detail ? <Text style={styles.nextDetail}>{next.detail}</Text> : null}
              </View>
              <View style={styles.nextGo}>
                <ArrowRight size={18} color="#fff" strokeWidth={2.6} />
              </View>
            </Pressable>
          ) : null}

          <SegmentTabs
            floating
            padded={false}
            value={tab}
            onChange={(t) => {
              setTab(t);
              router.setParams({ tab: t });
            }}
            tabs={[
              { key: "surveys", label: `Surveys${surveys.length ? ` ${surveys.length}` : ""}` },
              { key: "measurements", label: `Measurements${measurements.length ? ` ${measurements.length}` : ""}` },
              { key: "estimates", label: `Estimates${estimates.length ? ` ${estimates.length}` : ""}` },
            ]}
          />

          {summaryQ.isLoading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 16 }} /> : null}

          {tab === "surveys" ? (
            <>
              <AddButton label="New survey" onPress={() => create("surveys")} />
              {!summaryQ.isLoading && surveys.length === 0 ? <EmptyState title="No surveys yet" subtitle="Start with a survey: what the customer wants and the site's condition." /> : null}
              {surveys.map((s) => (
                <SurveyRow key={String(s.id)} survey={s} onPress={() => router.push(`/(tabs)/surveys/${s.id}` as never)} />
              ))}
            </>
          ) : null}

          {tab === "measurements" ? (
            <>
              <AddButton label="New measurement" onPress={() => create("measurements")} />
              {!summaryQ.isLoading && measurements.length === 0 ? <EmptyState title="No measurements yet" subtitle="Measure rooms and surfaces — totals flow into the estimate." /> : null}
              {measurements.map((m) => (
                <MeasurementRow key={String(m.id)} measurement={m} onPress={() => router.push(`/(tabs)/measurements/${m.id}` as never)} />
              ))}
            </>
          ) : null}

          {tab === "estimates" ? (
            <>
              <AddButton label="New estimate" onPress={() => create("estimates")} />
              {!summaryQ.isLoading && estimates.length === 0 ? <EmptyState title="No estimates yet" subtitle="Price the measured work, materials and tool charges." /> : null}
              {estimates.map((e) => (
                <EstimateRow key={String(e.id)} estimate={e} onPress={() => drawer.open(String(e.id))} />
              ))}
            </>
          ) : null}

          <Pressable style={[styles.danger, del.isPending && { opacity: 0.6 }]} onPress={confirmDelete} disabled={del.isPending}>
            {del.isPending ? (
              <ActivityIndicator color={p.red} />
            ) : (
              <>
                <Trash2 size={18} color={p.red} strokeWidth={2.4} />
                <Text style={styles.dangerText}>Delete site</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
        <SiteFilesDrawer siteId={String(id)} siteName={String(site.name || "")} visible={filesOpen} onClose={() => setFilesOpen(false)} />
        {drawer.element}
      </SafeAreaView>
    </SoftBackground>
  );
}

function Action({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.action, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.addBtn} onPress={onPress} accessibilityRole="button">
      <Plus size={18} color="#fff" strokeWidth={2.6} />
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: tabBarClearance },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  info: { backgroundColor: p.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: p.border, padding: spacing.md, marginBottom: spacing.md, ...cardShadow },
  infoTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  pin: { width: 48, height: 48, borderRadius: 16, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  name: { color: p.text, fontSize: 19, fontWeight: "800" },
  type: { color: p.muted, fontSize: 13, fontWeight: "600", marginTop: 2 },
  address: { color: p.text, fontSize: 14, marginTop: 12, lineHeight: 20 },
  access: { color: p.muted, fontSize: 13, marginTop: 6 },
  customer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.border },
  customerText: { flex: 1, color: p.text, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  action: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: radius.md, backgroundColor: p.background, borderWidth: 1, borderColor: p.border },
  actionText: { color: p.text, fontSize: 12, fontWeight: "700" },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.claySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.clayMid,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  nextLabel: { color: p.clayDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  nextTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginTop: 3 },
  nextDetail: { color: p.muted, fontSize: 13, marginTop: 2 },
  nextGo: { width: 38, height: 38, borderRadius: 19, backgroundColor: p.clay, alignItems: "center", justifyContent: "center" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 13,
    marginBottom: 12,
  },
  addText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  danger: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: p.redSoft,
  },
  dangerText: { color: p.red, fontWeight: "700", fontSize: 15 },
});
