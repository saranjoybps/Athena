import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { requestUpgrade, refreshSession } from "@/lib/auth";
import { showTrialBanner } from "@/lib/entitlements";
import { useAuthStore } from "@/store";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

export function TrialBanner() {
  const user = useAuthStore((s) => s.user);
  const ents = user?.entitlements;
  const [busy, setBusy] = useState(false);
  if (!showTrialBanner(ents)) return null;
  const days = ents?.days_remaining ?? 0;
  const pending = Boolean(ents?.upgrade_request_pending);

  async function onUpgrade() {
    setBusy(true);
    try {
      await requestUpgrade("Please upgrade this workspace.");
      await refreshSession();
      Toast.show({ type: "success", text1: "Upgrade requested" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Could not send request", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>
        {ents?.status === "trial" ? `${days} day${days === 1 ? "" : "s"} left on your trial.` : "Account limits are enforced."}
      </Text>
      <Text style={styles.meta}>
        Users {ents?.usage?.users ?? 0}/{ents?.limits?.users || "∞"} · Customers {ents?.usage?.customers ?? 0}/
        {ents?.limits?.customers || "∞"} · Sites {ents?.usage?.sites ?? 0}/{ents?.limits?.sites || "∞"}
      </Text>
      <Pressable style={[styles.btn, (busy || pending) && { opacity: 0.5 }]} onPress={onUpgrade} disabled={busy || pending}>
        <Text style={styles.btnText}>{pending ? "Waiting for Athena admin" : "Request upgrade"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: "#9a3412", fontWeight: "700" },
  meta: { color: "#9a3412", marginTop: 6, fontSize: 12 },
  btn: { marginTop: 10, backgroundColor: p.clay, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
