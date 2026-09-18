import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useInviteUser, useUsers } from "@/hooks/useApi";
import { quotaReached } from "@/lib/entitlements";
import { useAuthStore } from "@/store";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

const MODULES = [
  { value: "admin", label: "Admin" },
  { value: "home", label: "Home" },
  { value: "accounts", label: "Accounts" },
  { value: "inventory", label: "Inventory" },
  { value: "field", label: "Field" },
] as const;

function accessLabel(item: Record<string, unknown>): string {
  if (Array.isArray(item.access) && item.access.length) return item.access.map(String).join(", ");
  if (Array.isArray(item.roles) && item.roles.length) {
    return item.roles.map((r) => String(r).replace(/_/g, " ")).join(", ");
  }
  return String(item.role || item.status || "");
}

export default function UsersScreen() {
  const router = useRouter();
  const q = useUsers();
  const invite = useInviteUser();
  const entitlements = useAuthStore((s) => s.user?.entitlements);
  const items = q.data?.items ?? [];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [modules, setModules] = useState<string[]>(["field"]);

  function toggle(mod: string) {
    setModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  }

  async function submitInvite() {
    if (quotaReached(entitlements, "users")) {
      Toast.show({ type: "error", text1: "Account limit reached" });
      return;
    }
    if (!email.trim() || !name.trim()) {
      Toast.show({ type: "error", text1: "Name and email required" });
      return;
    }
    if (!modules.length) {
      Toast.show({ type: "error", text1: "Select at least one access module" });
      return;
    }
    try {
      await invite.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        roles: modules,
      });
      Toast.show({ type: "success", text1: "User invited" });
      setOpen(false);
      setName("");
      setEmail("");
      setModules(["field"]);
      q.refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Invite failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const subtitle = useMemo(() => "Access modules shown per user", []);

  return (
    <>
      <ModuleListScreen
        title="Users"
        subtitle={subtitle}
        items={items}
        loading={q.isLoading}
        refreshing={q.isRefetching}
        errorMessage={q.isError ? (q.error as { userMessage?: string })?.userMessage : undefined}
        onBack={() => router.back()}
        onRetry={() => q.refetch()}
        onRefresh={() => q.refetch()}
        onAdd={() => {
          if (quotaReached(entitlements, "users")) {
            Toast.show({ type: "error", text1: "Account limit reached" });
            return;
          }
          setOpen(true);
        }}
        emptyTitle="No users listed"
        emptySubtitle="Invite teammates and assign module access."
        renderItem={(item) => (
          <RecordCard
            title={String(item.name || item.displayName || item.email || item.id)}
            subtitle={`${String(item.email || "—")} · ${accessLabel(item)}`}
            status={accessLabel(item)}
          />
        )}
      />

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalWrap}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Invite user</Text>
            <Text style={styles.label}>Full name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Access</Text>
            {MODULES.map((m) => (
              <Pressable key={m.value} style={styles.checkRow} onPress={() => toggle(m.value)}>
                <View style={[styles.checkbox, modules.includes(m.value) && styles.checkboxOn]} />
                <Text style={styles.checkText}>{m.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.btn} onPress={submitInvite} disabled={invite.isPending}>
              {invite.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Invite</Text>}
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    maxHeight: "85%",
    backgroundColor: p.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: p.text, marginBottom: 8 },
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: p.border },
  checkboxOn: { backgroundColor: p.clay, borderColor: p.clay },
  checkText: { color: p.text, fontWeight: "600" },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  cancel: { marginTop: 12, alignItems: "center", padding: 10 },
  cancelText: { color: p.muted, fontWeight: "600" },
});
