import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  LogOut,
  Package,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UsersRound,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { deleteAccount, signOut } from "@/lib/auth";
import { getPrivacyPolicyUrl } from "@/lib/config";
import { useOrgBranding } from "@/hooks/useApi";
import { hasPermission } from "@/lib/permissions";
import { missingOrgDetails } from "@/lib/organization";
import { useAuthStore } from "@/store";
import { SoftBackground } from "@/components/ui/SoftBackground";
import { softShadow, lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type Module = { label: string; href: string; icon: LucideIcon };

const MODULES: Module[] = [
  { label: "Reports", href: "/(tabs)/more/reports", icon: BarChart3 },
  { label: "Payments", href: "/(tabs)/payments", icon: Wallet },
  { label: "Attendance", href: "/(tabs)/attendance", icon: ClipboardList },
  { label: "Tools", href: "/(tabs)/more/tools", icon: Wrench },
  { label: "Materials", href: "/(tabs)/materials", icon: Package },
  { label: "People", href: "/(tabs)/labour", icon: UsersRound },
];

const COLUMNS = 3;
const GAP = 10;

export default function MoreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const canReadOrg = hasPermission(user, "invoice.read");
  const org = useOrgBranding(canReadOrg);

  const orgName = org.data?.company_name || user?.businessName || "Your business";
  const firstName = orgName.split(/\s+/)[0];
  const initials = orgName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  const missing = missingOrgDetails(org.data);
  const orgMeta = [org.data?.gst_number ? `GSTIN ${org.data.gst_number}` : null, org.data?.phone].filter(Boolean).join(" · ");
  const tileWidth = Math.floor((width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently removes your sign-in and disables your workspace access. Some business records may be retained for legal or tax purposes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              Toast.show({ type: "success", text1: "Account deleted" });
              router.replace("/(auth)/login" as never);
            } catch (e) {
              Toast.show({
                type: "error",
                text1: "Could not delete account",
                text2: (e as { userMessage?: string })?.userMessage || "Please try again.",
              });
            }
          },
        },
      ],
    );
  }

  return (
    <SoftBackground>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "A"}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.hello} numberOfLines={1}>
                Hello, {firstName}! 👋
              </Text>
              <Text style={styles.helloSub} numberOfLines={1}>
                {user?.email || "Manage your workspace"}
              </Text>
            </View>
          </View>

          <Pressable style={styles.orgCard} onPress={() => router.push("/(tabs)/more/organization" as never)}>
            <View style={styles.orgIcon}>
              <Building2 size={22} color={p.clayDark} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.orgLabel}>Organization</Text>
              <Text style={styles.orgName} numberOfLines={1}>
                {orgName}
              </Text>
              {orgMeta ? (
                <Text style={styles.orgMeta} numberOfLines={1}>
                  {orgMeta}
                </Text>
              ) : null}
              {org.data?.company_address ? (
                <Text style={styles.orgMeta} numberOfLines={1}>
                  {org.data.company_address}
                </Text>
              ) : null}
              {missing.length ? (
                <View style={styles.missingChip}>
                  <Text style={styles.missingText} numberOfLines={1}>
                    Add {missing.join(", ")}
                  </Text>
                </View>
              ) : null}
            </View>
            <ChevronRight size={18} color={p.faint} />
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modules</Text>
            <View style={styles.grid}>
              {MODULES.map(({ label, href, icon: Icon }) => (
                <Pressable
                  key={href}
                  style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && styles.tilePressed]}
                  onPress={() => router.push(href as never)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <View style={styles.tileIcon}>
                    <Icon size={22} color={p.clayDark} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={2}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.list}>
              <ListRow icon={ShieldCheck} label="Privacy policy" onPress={() => Linking.openURL(getPrivacyPolicyUrl())} />
              <ListRow
                icon={LogOut}
                label="Sign out"
                tone="danger"
                border
                onPress={async () => {
                  await signOut();
                  router.replace("/(auth)/login" as never);
                }}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: p.red }]}>Danger zone</Text>
            <View style={styles.danger}>
              <View style={styles.dangerHead}>
                <View style={styles.dangerIcon}>
                  <ShieldAlert size={20} color={p.red} strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.dangerTitle}>Delete account</Text>
                  <Text style={styles.dangerBody}>
                    Permanently removes your sign-in and workspace access. This can't be undone.
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.85 }]}
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <Trash2 size={16} color="#fff" strokeWidth={2.4} />
                <Text style={styles.dangerBtnText}>Delete my account</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.powered}>
              Powered by <Text style={styles.poweredBrand}>joybps</Text>
            </Text>
            <Text style={styles.version}>Athena v{Constants.expoConfig?.version ?? "—"}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function ListRow({
  icon: Icon,
  label,
  onPress,
  border,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  border?: boolean;
  tone?: "danger";
}) {
  const color = tone === "danger" ? p.red : p.text;
  return (
    <Pressable style={[styles.row, border && styles.rowBorder]} onPress={onPress}>
      <View style={[styles.rowIcon, tone === "danger" && { backgroundColor: p.redSoft }]}>
        <Icon size={18} color={tone === "danger" ? p.red : p.clayDark} strokeWidth={2.2} />
      </View>
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {tone === "danger" ? null : <ChevronRight size={18} color={p.faint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.lg },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: p.clay,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    ...softShadow,
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  hello: { color: p.text, fontSize: 19, fontWeight: "800" },
  helloSub: { color: p.muted, fontSize: 13, marginTop: 2 },
  orgCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    ...softShadow,
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: p.clayMid,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  orgLabel: { color: p.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  orgName: { color: p.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  orgMeta: { color: p.muted, fontSize: 12, marginTop: 2 },
  missingChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: p.amberSoft,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  missingText: { color: p.amber, fontSize: 12, fontWeight: "700" },
  section: { marginTop: spacing.lg },
  sectionTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginBottom: 10, marginLeft: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 4,
    minHeight: 104,
    ...softShadow,
  },
  tilePressed: { opacity: 0.7 },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: p.clayMid,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileLabel: { color: p.text, fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 15 },
  list: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    overflow: "hidden",
    ...softShadow,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.md, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: p.border },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "700" },
  danger: {
    backgroundColor: p.redSoft,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "rgba(220,38,38,0.35)",
    padding: spacing.md,
    gap: 14,
  },
  dangerHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.25)",
  },
  dangerTitle: { color: p.red, fontSize: 15, fontWeight: "800" },
  dangerBody: { color: p.text, fontSize: 13, lineHeight: 18, marginTop: 3, opacity: 0.8 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: p.red,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  dangerBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  footer: { alignItems: "center", marginTop: spacing.xl, gap: 2 },
  powered: { color: p.muted, fontSize: 12, fontWeight: "600" },
  poweredBrand: { color: p.clayDark, fontWeight: "800" },
  version: { color: p.faint, fontSize: 11, textAlign: "center", marginTop: 2 },
});
