import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { requestUpgrade, refreshSession } from "@/lib/auth";
import { showTrialBanner } from "@/lib/entitlements";
import { useAuthStore } from "@/store";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

/** Compact trial chip for headers — tap for usage details + upgrade. */
export function TrialBanner() {
  const user = useAuthStore((s) => s.user);
  const ents = user?.entitlements;
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!showTrialBanner(ents)) return null;

  const days = ents?.days_remaining ?? 0;
  const pending = Boolean(ents?.upgrade_request_pending);
  const expired = Boolean(ents?.trial_expired);

  const planLabel = expired
    ? "Trial ended"
    : ents?.status === "trial"
      ? `Trial · ${days}d left`
      : ents?.plan
        ? `${String(ents.plan).charAt(0).toUpperCase()}${String(ents.plan).slice(1)}`
        : "Plan limits";

  const usageLabel = `Users ${ents?.usage?.users ?? 0}/${ents?.limits?.users || "∞"} · Customers ${ents?.usage?.customers ?? 0}/${
    ents?.limits?.customers || "∞"
  } · Sites ${ents?.usage?.sites ?? 0}/${ents?.limits?.sites || "∞"}`;

  async function onUpgrade() {
    setBusy(true);
    try {
      await requestUpgrade("Please upgrade this workspace.");
      await refreshSession();
      Toast.show({ type: "success", text1: "Upgrade requested" });
      setOpen(false);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Could not send request",
        text2: (e as { userMessage?: string })?.userMessage,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.chip, expired ? styles.chipExpired : styles.chipTrial]}
          accessibilityRole="button"
          accessibilityLabel={`${planLabel}. ${usageLabel}`}
        >
          <Text style={[styles.chipText, expired && styles.chipTextExpired]} numberOfLines={1}>
            {planLabel}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.upgradeBtn, (busy || pending) && { opacity: 0.55 }]}
          onPress={onUpgrade}
          disabled={busy || pending}
        >
          <Text style={styles.upgradeText}>{pending ? "Pending" : busy ? "…" : "Upgrade"}</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{planLabel}</Text>
            <Text style={styles.sheetMeta}>{usageLabel}</Text>
            {expired ? (
              <Text style={styles.sheetHint}>Your trial has ended. Request an upgrade to continue.</Text>
            ) : (
              <Text style={styles.sheetHint}>Account limits for this workspace.</Text>
            )}
            <Pressable
              style={[styles.sheetBtn, (busy || pending) && { opacity: 0.55 }]}
              onPress={onUpgrade}
              disabled={busy || pending}
            >
              <Text style={styles.sheetBtnText}>
                {pending ? "Waiting for Athena admin" : busy ? "Sending…" : "Request upgrade"}
              </Text>
            </Pressable>
            <Pressable style={styles.sheetDismiss} onPress={() => setOpen(false)}>
              <Text style={styles.sheetDismissText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "58%" },
  chip: {
    flexShrink: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipTrial: { backgroundColor: "#fff7ed", borderColor: "#fdba74" },
  chipExpired: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  chipText: { color: "#9a3412", fontSize: 11, fontWeight: "700" },
  chipTextExpired: { color: "#991b1b" },
  upgradeBtn: {
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  upgradeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: p.border,
  },
  sheetTitle: { color: p.text, fontSize: 17, fontWeight: "800" },
  sheetMeta: { color: p.muted, marginTop: 8, fontSize: 13, lineHeight: 18 },
  sheetHint: { color: p.faint, marginTop: 10, fontSize: 12, lineHeight: 17 },
  sheetBtn: {
    marginTop: spacing.md,
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  sheetBtnText: { color: "#fff", fontWeight: "700" },
  sheetDismiss: { marginTop: 10, alignItems: "center", paddingVertical: 8 },
  sheetDismissText: { color: p.muted, fontWeight: "600" },
});
