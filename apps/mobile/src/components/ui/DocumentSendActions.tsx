import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { Mail, MessageCircle } from "lucide-react-native";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Props = {
  kind: "quotation" | "invoice";
  number?: string | null;
  pdfUrl?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  emailBusy?: boolean;
  onEmail: () => Promise<void> | void;
  /** Ensure PDF exists; return url (may be empty). */
  ensurePdf: () => Promise<string>;
};

function labelFor(kind: Props["kind"]) {
  return kind === "invoice" ? "Invoice" : "Estimate";
}

/** Email + WhatsApp row for estimate/invoice detail. */
export function DocumentSendActions({
  kind,
  number,
  pdfUrl,
  customerPhone,
  customerEmail,
  emailBusy,
  onEmail,
  ensurePdf,
}: Props) {
  const [waBusy, setWaBusy] = useState(false);
  const hasEmail = Boolean((customerEmail || "").trim());

  async function onWhatsApp() {
    setWaBusy(true);
    try {
      let url = normalizePdfUrl(pdfUrl);
      if (!url || url.includes("/raw/upload/")) {
        url = normalizePdfUrl(await ensurePdf());
      }
      const message = [
        `${labelFor(kind)} ${number || ""} from Athena.`.trim(),
        url ? `PDF: ${url}` : "PDF link will follow once generated.",
      ].join("\n");
      await shareViaWhatsApp({ phone: customerPhone, message });
      if (!customerPhone) {
        Toast.show({ type: "info", text1: "Pick a chat", text2: "Customer has no phone on file" });
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Could not open WhatsApp",
        text2: (e as Error)?.message,
      });
    } finally {
      setWaBusy(false);
    }
  }

  async function onEmailPress() {
    if (!hasEmail) {
      Toast.show({ type: "info", text1: "No customer email", text2: "Add an email on the customer record" });
      return;
    }
    await onEmail();
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Send to customer</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.emailBtn, (!hasEmail || emailBusy) && styles.disabled]}
          onPress={onEmailPress}
          disabled={emailBusy || !hasEmail}
        >
          {emailBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Mail size={18} color="#fff" strokeWidth={2.4} />
              <Text style={styles.emailText}>Email</Text>
            </>
          )}
        </Pressable>
        <Pressable style={[styles.waBtn, waBusy && styles.disabled]} onPress={onWhatsApp} disabled={waBusy}>
          {waBusy ? (
            <ActivityIndicator color="#25D366" />
          ) : (
            <>
              <MessageCircle size={18} color="#25D366" strokeWidth={2.4} />
              <Text style={styles.waText}>WhatsApp</Text>
            </>
          )}
        </Pressable>
      </View>
      {!hasEmail ? <Text style={styles.hint}>Email disabled — add an email on the customer.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    gap: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: p.muted,
  },
  row: { flexDirection: "row", gap: 10 },
  emailBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  emailText: { color: "#fff", fontWeight: "700" },
  waBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: p.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#25D366",
  },
  waText: { color: "#15803D", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  hint: { color: p.muted, fontSize: 13 },
});
