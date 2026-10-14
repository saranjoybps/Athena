import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderKanban,
  GitPullRequestArrow,
  Package,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useCustomers, useDashboard, useOrgBranding, usePayments, useProjects } from "@/hooks/useApi";
import { useAuthStore } from "@/store";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { HeroBackdrop, HeroHouse } from "@/components/home/HeroArt";
import { customerDisplayName } from "@/lib/customers";
import { formatCurrency, formatDate } from "@/lib/format";
import { methodMeta } from "@/lib/payments";
import { hasPermission } from "@/lib/permissions";
import { projectStatusMeta } from "@/lib/projects";
import { cardShadow, lightPalette as p, radius, softShadow, spacing, tabBarClearance } from "@/lib/theme";

type Row = Record<string, unknown>;
type Scope = "all" | "customers" | "projects";
type RecentTab = "projects" | "payments";

const QUICK: { label: string; href: string; icon: LucideIcon; tint: string; color: string }[] = [
  { label: "Attendance", href: "/(tabs)/attendance", icon: ClipboardCheck, tint: p.mint, color: p.green },
  { label: "Payments", href: "/(tabs)/payments", icon: Wallet, tint: p.sky, color: p.blue },
  { label: "Estimates", href: "/(tabs)/estimates", icon: FileText, tint: p.lilac, color: p.purple },
  { label: "People", href: "/(tabs)/labour", icon: UsersRound, tint: p.peach, color: p.clayDark },
];

const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "customers", label: "Customers" },
  { key: "projects", label: "Projects" },
];

const HERO_H = 196;

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "A"
  );
}

function byRecent(a: Row, b: Row) {
  return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  // Skip requests the API would reject with 403 for this role.
  const canViewReports = hasPermission(user, "report.view");
  const canViewPayments = hasPermission(user, "payment.view");
  const canViewProjects = hasPermission(user, "project.read");
  const canReadCustomers = hasPermission(user, "customer.read");
  const canReadOrg = hasPermission(user, "invoice.read");

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [showScopes, setShowScopes] = useState(false);
  const [searchUsed, setSearchUsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [recentTab, setRecentTab] = useState<RecentTab>(canViewProjects ? "projects" : "payments");

  const dash = useDashboard(canViewReports);
  const payments = usePayments(canViewPayments);
  const projectsQ = useProjects(canViewProjects);
  const customersQ = useCustomers(canReadCustomers && searchUsed);
  const org = useOrgBranding(canReadOrg);

  const displayName = String(org.data?.company_name || user?.businessName || user?.email || "there");
  const logo = String(org.data?.logo_url || "");
  const heroWidth = width - spacing.lg * 2;
  const tileWidth = Math.floor((heroWidth - 12 * 3) / 4);

  const d = dash.data || {};
  const outstanding = Number(d.outstanding ?? 0) || 0;
  const collected = Number(d.collections ?? 0) || 0;
  const billed = outstanding + collected;
  const collectionPct = billed > 0 ? Math.round((collected / billed) * 100) : 0;
  const pendingEstimates = Number(d.pendingQuotations ?? 0) || 0;
  const pendingChangeOrders = Number(d.pendingChangeOrders ?? 0) || 0;
  const materialRequests = Number(d.materialRequests ?? 0) || 0;
  const activeProjects = Number(d.activeProjects ?? 0) || 0;

  const attention = [
    outstanding > 0
      ? { key: "due", icon: Wallet, tint: p.amberSoft, color: p.amber, title: `${formatCurrency(outstanding)} to collect`, detail: "Unpaid invoice balances", href: "/(tabs)/invoices" }
      : null,
    pendingEstimates > 0
      ? {
          key: "estimates",
          icon: FileText,
          tint: p.lilac,
          color: p.purple,
          title: `${pendingEstimates} estimate${pendingEstimates === 1 ? "" : "s"} awaiting approval`,
          detail: "Follow up with the customer",
          href: "/(tabs)/estimates",
        }
      : null,
    pendingChangeOrders > 0
      ? {
          key: "co",
          icon: GitPullRequestArrow,
          tint: p.sky,
          color: p.blue,
          title: `${pendingChangeOrders} change order${pendingChangeOrders === 1 ? "" : "s"} not sent`,
          detail: "Send them for the customer's approval",
          href: "/(tabs)/projects",
        }
      : null,
    materialRequests > 0
      ? {
          key: "materials",
          icon: Package,
          tint: p.butter,
          color: p.amber,
          title: `${materialRequests} material request${materialRequests === 1 ? "" : "s"}`,
          detail: "Waiting to be ordered",
          href: "/(tabs)/materials",
        }
      : null,
  ].filter(Boolean) as { key: string; icon: LucideIcon; tint: string; color: string; title: string; detail: string; href: string }[];

  const recentProjects = useMemo(() => [...(projectsQ.data?.items ?? [])].sort(byRecent).slice(0, 5), [projectsQ.data]);
  const recentPayments = useMemo(() => [...(payments.data?.items ?? [])].sort(byRecent).slice(0, 5), [payments.data]);

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    const hit = (values: unknown[]) => values.some((v) => String(v || "").toLowerCase().includes(needle));
    const out: { key: string; icon: LucideIcon; tint: string; color: string; title: string; detail: string; href: string }[] = [];
    if (scope !== "projects") {
      for (const c of (customersQ.data?.items ?? []).filter((c) => hit([customerDisplayName(c), c.name, c.company, c.phone, c.email])).slice(0, 6)) {
        out.push({
          key: `c-${c.id}`,
          icon: UserRound,
          tint: p.sky,
          color: p.blue,
          title: customerDisplayName(c),
          detail: String(c.phone || "Customer"),
          href: `/(tabs)/customers/${c.id}`,
        });
      }
    }
    if (scope !== "customers") {
      for (const pr of (projectsQ.data?.items ?? []).filter((pr) => hit([pr.name, pr.number])).slice(0, 6)) {
        out.push({
          key: `p-${pr.id}`,
          icon: FolderKanban,
          tint: p.claySoft,
          color: p.clayDark,
          title: String(pr.name || pr.number || "Project"),
          detail: [pr.number, projectStatusMeta(pr.status).label].filter(Boolean).map(String).join(" · "),
          href: `/(tabs)/projects/${pr.id}`,
        });
      }
    }
    return out;
  }, [needle, scope, customersQ.data, projectsQ.data]);
  const searching = Boolean(needle);
  const searchLoading = (scope !== "projects" && customersQ.isLoading && canReadCustomers) || (scope !== "customers" && projectsQ.isLoading && canViewProjects);

  function go(href: string) {
    router.push(href as never);
  }

  function refresh() {
    if (canViewReports) dash.refetch();
    if (canViewPayments) payments.refetch();
    if (canViewProjects) projectsQ.refetch();
    if (canReadOrg) org.refetch();
    if (searchUsed && canReadCustomers) customersQ.refetch();
  }

  const hero = (() => {
    if (canViewReports && dash.isLoading) {
      return { eyebrow: "Collections", title: "Loading…", sub: "Fetching received and due amounts", cta: "View payments", href: "/(tabs)/payments", progress: null as number | null };
    }
    if (canViewReports && billed > 0) {
      return outstanding > 0
        ? {
            eyebrow: "To collect",
            title: formatCurrency(outstanding),
            sub: `${formatCurrency(collected)} received · ${collectionPct}% collected`,
            cta: "View payments",
            href: "/(tabs)/payments",
            progress: collectionPct,
          }
        : {
            eyebrow: "All collected",
            title: formatCurrency(collected),
            sub: "Every billed amount has been received",
            cta: "View payments",
            href: "/(tabs)/payments",
            progress: 100,
          };
    }
    return {
      eyebrow: "Get started",
      title: "Win your next job",
      sub: "Add a customer, measure the site and send a branded estimate.",
      cta: "Add customer",
      href: "/(tabs)/customers/new",
      progress: null,
    };
  })();

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={dash.isRefetching || projectsQ.isRefetching || payments.isRefetching} onRefresh={refresh} tintColor={p.clay} />}
        >
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.hello}>👋 {greeting()}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <Pressable style={styles.bellBtn} onPress={() => setBellOpen(true)} accessibilityRole="button" accessibilityLabel="Things that need attention">
              <Bell size={21} color={p.text} strokeWidth={2.2} />
              {attention.length ? <View style={styles.bellDot} /> : null}
            </Pressable>
            <Pressable style={styles.avatar} onPress={() => go("/(tabs)/more")} accessibilityRole="button" accessibilityLabel="Open more">
              {logo ? <Image source={{ uri: logo }} style={styles.avatarImg} resizeMode="cover" /> : <Text style={styles.avatarText}>{initialsOf(displayName)}</Text>}
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Search size={19} color={p.faint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchUsed(true)}
                placeholder="Search customers or projects"
                placeholderTextColor={p.faint}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                  <X size={17} color={p.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={[styles.filterBtn, (showScopes || scope !== "all") && styles.filterBtnOn]}
              onPress={() => setShowScopes((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Search filters"
              accessibilityState={{ expanded: showScopes }}
            >
              <SlidersHorizontal size={20} color="#fff" strokeWidth={2.3} />
            </Pressable>
          </View>
          {showScopes ? (
            <View style={styles.scopes}>
              {SCOPES.map((s) => {
                const on = scope === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => {
                      setScope(s.key);
                      setShowScopes(false);
                    }}
                    style={[styles.scopeChip, on && styles.scopeChipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.scopeText, on && styles.scopeTextOn]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {searching ? (
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>
                {searchLoading ? "Searching…" : results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : "No matches"}
              </Text>
              {!searchLoading && !results.length ? <Text style={styles.resultsEmpty}>Try a name, phone number or project number.</Text> : null}
              {results.map((r, i) => (
                <ListItem key={r.key} icon={r.icon} tint={r.tint} color={r.color} title={r.title} detail={r.detail} onPress={() => go(r.href)} last={i === results.length - 1} />
              ))}
            </View>
          ) : (
            <>
              {canViewReports && dash.isError ? (
                <ErrorBanner message={(dash.error as { userMessage?: string })?.userMessage || "Couldn't load your numbers."} onRetry={() => dash.refetch()} />
              ) : null}

              <View style={[styles.hero, { height: HERO_H }]}>
                <HeroBackdrop width={heroWidth} height={HERO_H} />
                <View style={styles.heroArt} pointerEvents="none">
                  <HeroHouse size={142} />
                </View>
                <View style={styles.heroBody}>
                  <View style={styles.heroEyebrow}>
                    <Text style={styles.heroEyebrowText}>{hero.eyebrow}</Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={2} adjustsFontSizeToFit>
                    {hero.title}
                  </Text>
                  <Text style={styles.heroSub} numberOfLines={2}>
                    {hero.sub}
                  </Text>
                  {hero.progress != null ? (
                    <View style={styles.heroTrack}>
                      <View style={[styles.heroFill, { width: `${Math.min(100, Math.max(4, hero.progress))}%` }]} />
                    </View>
                  ) : null}
                  <Pressable style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.85 }]} onPress={() => go(hero.href)} accessibilityRole="button">
                    <Text style={styles.heroBtnText}>{hero.cta}</Text>
                    <ArrowRight size={15} color={p.clayDark} strokeWidth={2.6} />
                  </Pressable>
                </View>
              </View>

              {canViewReports && !dash.isLoading ? (
                <View style={styles.stats}>
                  <Stat label="Active projects" value={activeProjects} icon={FolderKanban} color={p.clayDark} tint={p.claySoft} onPress={() => go("/(tabs)/projects")} />
                  <Stat label="Estimates pending" value={pendingEstimates} icon={FileText} color={p.purple} tint={p.lilac} onPress={() => go("/(tabs)/estimates")} />
                  <Stat label="Change orders" value={pendingChangeOrders} icon={GitPullRequestArrow} color={p.blue} tint={p.sky} onPress={() => go("/(tabs)/projects")} />
                </View>
              ) : null}

              <View style={styles.quickRow}>
                {QUICK.map(({ label, href, icon: Icon, tint, color }) => (
                  <Pressable
                    key={label}
                    style={({ pressed }) => [styles.quick, { width: tileWidth }, pressed && { opacity: 0.75 }]}
                    onPress={() => go(href)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <View style={[styles.quickIcon, { backgroundColor: tint }]}>
                      <Icon size={24} color={color} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.quickLabel} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {canViewProjects || canViewPayments ? (
                <View>
                  <View style={styles.sectionRow}>
                    <Text style={styles.section}>Recent activity</Text>
                    <Pressable onPress={() => go(recentTab === "projects" ? "/(tabs)/projects" : "/(tabs)/payments")} hitSlop={8}>
                      <Text style={styles.link}>View all</Text>
                    </Pressable>
                  </View>
                  {canViewProjects && canViewPayments ? (
                    <View style={styles.segment}>
                      {(["projects", "payments"] as RecentTab[]).map((t) => {
                        const on = recentTab === t;
                        return (
                          <Pressable key={t} onPress={() => setRecentTab(t)} style={[styles.segmentBtn, on && styles.segmentOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{t === "projects" ? "Projects" : "Payments"}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  {recentTab === "projects" ? (
                    recentProjects.length ? (
                      recentProjects.map((pr) => <ProjectItem key={String(pr.id)} project={pr} onPress={() => go(`/(tabs)/projects/${pr.id}`)} />)
                    ) : (
                      <EmptyCard
                        loading={projectsQ.isLoading}
                        title="No projects yet"
                        detail="Projects start from an approved estimate."
                        action="Open customers"
                        onAction={() => go("/(tabs)/customers")}
                      />
                    )
                  ) : recentPayments.length ? (
                    recentPayments.map((pay) => <PaymentItem key={String(pay.id)} payment={pay} onPress={() => go(`/(tabs)/payments/${pay.id}`)} />)
                  ) : (
                    <EmptyCard loading={payments.isLoading} title="No payments yet" detail="Payments you record against invoices show up here." />
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={bellOpen} transparent animationType="fade" onRequestClose={() => setBellOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBellOpen(false)}>
          <SafeAreaView edges={["top"]}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Needs attention</Text>
                <Pressable onPress={() => setBellOpen(false)} hitSlop={10} accessibilityLabel="Close">
                  <X size={20} color={p.muted} />
                </Pressable>
              </View>
              {attention.length ? (
                attention.map((a, i) => (
                  <ListItem
                    key={a.key}
                    icon={a.icon}
                    tint={a.tint}
                    color={a.color}
                    title={a.title}
                    detail={a.detail}
                    last={i === attention.length - 1}
                    onPress={() => {
                      setBellOpen(false);
                      go(a.href);
                    }}
                  />
                ))
              ) : (
                <View style={styles.caughtUp}>
                  <CheckCircle2 size={28} color={p.green} strokeWidth={2.2} />
                  <Text style={styles.caughtUpTitle}>You're all caught up</Text>
                  <Text style={styles.caughtUpText}>Nothing is waiting on you right now.</Text>
                </View>
              )}
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </SoftBackground>
  );
}

function Stat({ label, value, icon: Icon, color, tint, onPress }: { label: string; value: number; icon: LucideIcon; color: string; tint: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Icon size={15} color={color} strokeWidth={2.4} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ListItem({
  icon: Icon,
  tint,
  color,
  title,
  detail,
  onPress,
  last,
}: {
  icon: LucideIcon;
  tint: string;
  color: string;
  title: string;
  detail: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.listItem, last && { borderBottomWidth: 0 }]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.itemIcon, { backgroundColor: tint }]}>
        <Icon size={19} color={color} strokeWidth={2.3} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.itemDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={p.faint} />
    </Pressable>
  );
}

function ProjectItem({ project, onPress }: { project: Row; onPress: () => void }) {
  const status = projectStatusMeta(project.status);
  const progress = Math.max(0, Math.min(100, Number(project.completionPercent || 0)));
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.cardIcon, { backgroundColor: status.bg }]}>
        <FolderKanban size={22} color={status.fg} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {String(project.name || project.number || "Project")}
        </Text>
        <Text style={styles.cardDetail} numberOfLines={1}>
          {[project.number, formatDate(String(project.updatedAt || project.createdAt || ""))].filter(Boolean).map(String).join(" · ")}
        </Text>
        {progress > 0 ? (
          <View style={styles.miniTrack}>
            <View style={[styles.miniFill, { width: `${progress}%`, backgroundColor: status.fg }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.pill, { backgroundColor: status.bg }]}>
        <Text style={[styles.pillText, { color: status.fg }]}>{status.label}</Text>
      </View>
    </Pressable>
  );
}

function PaymentItem({ payment, onPress }: { payment: Row; onPress: () => void }) {
  const method = methodMeta(payment.method);
  const MethodIcon = method.icon;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress} accessibilityRole="button">
      <View style={[styles.cardIcon, { backgroundColor: p.greenSoft }]}>
        <MethodIcon size={22} color={p.green} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {formatCurrency(String(payment.amount || 0))}
        </Text>
        <Text style={styles.cardDetail} numberOfLines={1}>
          {[payment.customerName, formatDate(String(payment.createdAt || ""))].filter(Boolean).map(String).join(" · ")}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: p.greenSoft }]}>
        <Text style={[styles.pillText, { color: "#15803D" }]}>{method.label}</Text>
      </View>
    </Pressable>
  );
}

function EmptyCard({ loading, title, detail, action, onAction }: { loading: boolean; title: string; detail: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{loading ? "Loading…" : title}</Text>
      {loading ? null : <Text style={styles.emptyText}>{detail}</Text>}
      {!loading && action && onAction ? (
        <Pressable onPress={onAction} style={styles.emptyBtn} accessibilityRole="button">
          <Text style={styles.emptyBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: tabBarClearance },

  topRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  hello: { color: p.muted, fontSize: 14, fontWeight: "600" },
  name: { color: p.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
  bellBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  bellDot: { position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: p.red, borderWidth: 1.5, borderColor: "#fff" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#fff",
    ...softShadow,
  },
  avatarImg: { width: "100%", height: "100%", backgroundColor: "#fff" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  searchRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    paddingHorizontal: 14,
    height: 52,
    ...softShadow,
  },
  searchInput: { flex: 1, color: p.text, fontSize: 15, paddingVertical: 0 },
  filterBtn: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: p.clay, alignItems: "center", justifyContent: "center", ...softShadow },
  filterBtnOn: { backgroundColor: p.clayDark },
  scopes: { flexDirection: "row", gap: 8, marginTop: 10 },
  scopeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  scopeChipOn: { backgroundColor: p.text, borderColor: p.text },
  scopeText: { color: p.text, fontSize: 13, fontWeight: "700" },
  scopeTextOn: { color: "#fff" },

  resultsCard: { marginTop: spacing.md, backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingTop: 14, ...softShadow },
  resultsTitle: { color: p.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  resultsEmpty: { color: p.muted, fontSize: 13, paddingBottom: 16, paddingTop: 4 },

  hero: { marginTop: spacing.md, borderRadius: radius.xl, overflow: "hidden", ...cardShadow, shadowColor: "#C2410C", shadowOpacity: 0.28 },
  heroArt: { position: "absolute", right: 6, bottom: 4 },
  heroBody: { flex: 1, padding: 20, paddingRight: 128, justifyContent: "center" },
  heroEyebrow: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.22)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  heroEyebrowText: { color: "#fff", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  heroSub: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "600", marginTop: 4, lineHeight: 18 },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.28)", marginTop: 10, overflow: "hidden" },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: "#fff" },
  heroBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
  },
  heroBtnText: { color: p.clayDark, fontWeight: "800", fontSize: 13 },

  stats: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  stat: { flex: 1, backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: 12, ...softShadow },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { color: p.text, fontSize: 20, fontWeight: "800" },
  statLabel: { color: p.muted, fontSize: 11, fontWeight: "700", marginTop: 1 },

  quickRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  quick: { alignItems: "center" },
  quickIcon: { width: 62, height: 62, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8, ...softShadow },
  quickLabel: { color: p.text, fontSize: 12, fontWeight: "700" },

  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.lg, marginBottom: 10 },
  section: { color: p.text, fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  link: { color: p.clayDark, fontWeight: "800", fontSize: 13 },
  segment: { flexDirection: "row", backgroundColor: p.slateSoft, borderRadius: radius.full, padding: 4, marginBottom: 12 },
  segmentBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.full },
  segmentOn: { backgroundColor: p.surface, ...softShadow },
  segmentText: { color: p.muted, fontWeight: "700", fontSize: 13 },
  segmentTextOn: { color: p.text },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: 12,
    marginBottom: 10,
    ...softShadow,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: p.text, fontSize: 15, fontWeight: "800" },
  cardDetail: { color: p.muted, fontSize: 12, fontWeight: "500", marginTop: 3 },
  miniTrack: { height: 4, borderRadius: 2, backgroundColor: p.slateSoft, marginTop: 7, overflow: "hidden" },
  miniFill: { height: 4, borderRadius: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  pillText: { fontSize: 11, fontWeight: "800" },

  listItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border },
  itemIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  itemTitle: { color: p.text, fontSize: 14, fontWeight: "700" },
  itemDetail: { color: p.muted, fontSize: 12, marginTop: 2 },

  empty: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: spacing.md, alignItems: "center" },
  emptyTitle: { color: p.text, fontSize: 15, fontWeight: "800" },
  emptyText: { color: p.muted, fontSize: 13, marginTop: 4, textAlign: "center" },
  emptyBtn: { marginTop: 12, backgroundColor: p.claySoft, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  emptyBtnText: { color: p.clayDark, fontWeight: "800", fontSize: 13 },

  backdrop: { flex: 1, backgroundColor: "rgba(30,27,46,0.35)" },
  sheet: { margin: spacing.md, marginTop: 64, backgroundColor: p.surface, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 4, ...cardShadow },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sheetTitle: { color: p.text, fontSize: 17, fontWeight: "800" },
  caughtUp: { alignItems: "center", paddingVertical: 24, gap: 6 },
  caughtUpTitle: { color: p.text, fontSize: 15, fontWeight: "800" },
  caughtUpText: { color: p.muted, fontSize: 13 },
});
