import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Toast from "react-native-toast-message";
import { Ban, CheckCircle2, ChevronRight, FileText, FolderKanban, Mail, MessageCircle, Pencil, Phone, Send, Share2, Wallet } from "lucide-react-native";
import { useEnsureInvoicePdf, useInvoice, useInvoicePreview, usePaymentsFor, useSendInvoice, useVoidInvoice } from "@/hooks/useApi";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { shareApiFile } from "@/lib/files";
import { formatCurrency, formatDate } from "@/lib/format";
import { methodMeta } from "@/lib/payments";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Row = Record<string, unknown>;

export type InvoiceNav = {
  edit: (id: string, projectId?: string) => void;
  recordPayment: (id: string, projectId?: string) => void;
  payment: (paymentId: string) => void;
  project: (projectId: string) => void;
};

const STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: p.muted, bg: p.slateSoft },
  sent: { label: "Sent", fg: p.blue, bg: p.blueSoft },
  partially_paid: { label: "Part paid", fg: p.amber, bg: p.amberSoft },
  paid: { label: "Paid", fg: "#15803D", bg: p.greenSoft },
  void: { label: "Void", fg: p.red, bg: p.redSoft },
};

const KIND_LABEL: Record<string, string> = {
  advance: "Advance bill",
  progress: "Progress bill",
  milestone: "Milestone bill",
  final: "Final bill",
  quantity: "Quantity bill",
  tnm: "Time & material bill",
  standard: "Invoice",
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function errorText(e: unknown) {
  return (e as { userMessage?: string })?.userMessage || "Please try again.";
}

/** Everything needed to show and act on one invoice. */
export function useInvoiceState(id: string | undefined, enabled = true) {
  const invoiceQ = useInvoice(enabled ? id : undefined);
  const invoice = invoiceQ.data;
  const customer = (invoice?.customer as { name?: string; company?: string; phone?: string; email?: string } | undefined) || undefined;
  const status = String(invoice?.status || "draft");
  const total = Number(invoice?.total || 0);
  const paid = Number(invoice?.paid || 0);
  const outstanding = status === "void" ? 0 : Number(invoice?.outstanding || 0);
  return {
    invoiceQ,
    invoice,
    customer,
    phone: String(customer?.phone || "").trim(),
    email: String(customer?.email || "").trim(),
    status,
    meta: STATUS[status] || STATUS.draft,
    total,
    paid,
    outstanding,
    paidPct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0,
    projectId: String(invoice?.projectId || ""),
    number: String(invoice?.number || "Invoice"),
    kindLabel: KIND_LABEL[String(invoice?.kind || "")] || "Invoice",
    overdue: Boolean(invoice?.dueDate && outstanding > 0 && String(invoice.dueDate).slice(0, 10) < todayIso()),
    canEdit: status !== "paid" && status !== "void",
    canVoid: status !== "void" && paid <= 0,
    canSend: status === "draft" || status === "sent",
  };
}

export function InvoiceBody({ id, nav, enabled = true }: { id: string; nav: InvoiceNav; enabled?: boolean }) {
  const { width } = useWindowDimensions();
  const s = useInvoiceState(id, enabled);
  const { invoiceQ, invoice } = s;
  const paymentsQ = usePaymentsFor({ invoiceId: enabled ? id : undefined });
  const previewQ = useInvoicePreview(id, invoice?.updatedAt, enabled && Boolean(invoice));
  const pageWidth = width - spacing.lg * 2 - 2;

  const payments = useMemo(
    () => [...(paymentsQ.data?.items ?? [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    [paymentsQ.data],
  );

  if (invoiceQ.isLoading) return <ActivityIndicator color={p.clay} style={{ marginVertical: 32 }} />;
  if (invoiceQ.isError || !invoice) {
    return <ErrorBanner message={(invoiceQ.error as { userMessage?: string })?.userMessage || "Couldn't load this invoice."} onRetry={() => invoiceQ.refetch()} />;
  }

  const items = ((invoice.items as Row[] | undefined) || []).filter(Boolean);
  const tax = (invoice.tax as Row | undefined) || {};
  const ratePct = Number(tax.rate || 0) <= 1 ? Number(tax.rate || 0) * 100 : Number(tax.rate || 0);
  const next =
    s.status === "void"
      ? { tone: "red" as const, label: "Void", text: "This invoice was voided. It no longer counts towards the project's billed amount." }
      : s.status === "paid"
        ? { tone: "green" as const, label: "Settled", text: "Paid in full. Nothing left to collect on this invoice." }
        : s.status === "draft"
          ? { tone: "clay" as const, label: "Next step", text: "Review the PDF, then send it to the customer on WhatsApp or email." }
          : {
              tone: s.overdue ? ("red" as const) : ("clay" as const),
              label: s.overdue ? "Overdue" : "Next step",
              text: s.overdue
                ? `${formatCurrency(s.outstanding)} was due on ${formatDate(String(invoice.dueDate))}. Send the customer a reminder.`
                : `Collect ${formatCurrency(s.outstanding)}. Record each payment as it comes in.`,
            };
  const nextTone = { clay: [p.claySoft, p.clayMid, p.clayDark], green: [p.greenSoft, "#BBF7D0", "#15803D"], red: [p.redSoft, "#FECACA", p.red] }[next.tone];

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.tile}>
            <FileText size={24} color={p.clayDark} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroLabel}>{s.outstanding > 0 ? "Balance due" : "Invoice total"}</Text>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(s.outstanding > 0 ? s.outstanding : s.total)}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {[s.customer?.company || s.customer?.name, s.kindLabel, formatDate(String(invoice.createdAt || ""))].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <View style={[styles.pill, { backgroundColor: s.meta.bg }]}>
              <Text style={[styles.pillText, { color: s.meta.fg }]}>{s.meta.label}</Text>
            </View>
            {s.overdue ? (
              <View style={[styles.pill, { backgroundColor: p.redSoft }]}>
                <Text style={[styles.pillText, { color: p.red }]}>Overdue</Text>
              </View>
            ) : null}
          </View>
        </View>

        {s.status !== "void" ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${s.paidPct}%` }]} />
            </View>
            <Text style={styles.trackText}>{s.paidPct}% paid</Text>
          </>
        ) : null}

        <View style={styles.money}>
          <MoneyCell label="Total" value={formatCurrency(s.total)} />
          <View style={styles.moneySep} />
          <MoneyCell label="Paid" value={formatCurrency(s.paid)} tone="green" />
          <View style={styles.moneySep} />
          <MoneyCell label="Balance" value={formatCurrency(s.outstanding)} tone={s.outstanding > 0 ? "red" : undefined} />
        </View>
      </View>

      <View style={[styles.next, { backgroundColor: nextTone[0], borderColor: nextTone[1] }]}>
        <Text style={[styles.nextLabel, { color: nextTone[2] }]}>{next.label}</Text>
        <Text style={styles.nextText}>{next.text}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {items.length === 0 ? <Text style={styles.muted}>No line items.</Text> : null}
        {items.map((it, i) => {
          const qty = Number(it.quantity || 0);
          const rate = Number(it.rate || it.unit_price || 0);
          return (
            <View key={i} style={styles.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle}>{String(it.description || "Item")}</Text>
                {qty && rate ? (
                  <Text style={styles.itemSub}>
                    {qty} {String(it.unit || "")} × {formatCurrency(rate)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.itemAmt}>{formatCurrency(String(it.amount || 0))}</Text>
            </View>
          );
        })}
        <View style={styles.totals}>
          <Line label="Taxable amount" value={formatCurrency(String(tax.taxableAmount || s.total))} />
          {Number(tax.igst || 0) > 0 ? <Line label={`IGST @ ${ratePct}%`} value={formatCurrency(String(tax.igst))} /> : null}
          {Number(tax.cgst || 0) > 0 ? <Line label={`CGST @ ${ratePct / 2}%`} value={formatCurrency(String(tax.cgst))} /> : null}
          {Number(tax.sgst || 0) > 0 ? <Line label={`SGST @ ${ratePct / 2}%`} value={formatCurrency(String(tax.sgst))} /> : null}
          <Line label="Grand total" value={formatCurrency(s.total)} strong />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Payments</Text>
          {s.outstanding > 0 && s.status !== "void" ? (
            <Pressable onPress={() => nav.recordPayment(id, s.projectId || undefined)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.cardAction}>+ Record</Text>
            </Pressable>
          ) : null}
        </View>
        {paymentsQ.isLoading ? <ActivityIndicator color={p.clay} style={{ marginBottom: 12 }} /> : null}
        {!paymentsQ.isLoading && payments.length === 0 ? <Text style={styles.muted}>No payments received yet.</Text> : null}
        {payments.map((pay) => (
          <Pressable key={String(pay.id)} style={styles.item} onPress={() => nav.payment(String(pay.id))} accessibilityRole="button">
            <View style={styles.payIcon}>
              <Wallet size={16} color="#15803D" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemTitle}>{methodMeta(pay.method).label}</Text>
              <Text style={styles.itemSub}>{[formatDate(String(pay.createdAt || "")), pay.reference ? String(pay.reference) : ""].filter(Boolean).join(" · ")}</Text>
            </View>
            <Text style={[styles.itemAmt, { color: "#15803D" }]}>{formatCurrency(String(pay.amount || 0))}</Text>
            <ChevronRight size={16} color={p.faint} />
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <Line label="Invoice date" value={formatDate(String(invoice.createdAt || "")) || "—"} />
        <Line label="Due date" value={invoice.dueDate ? formatDate(String(invoice.dueDate)) : "Not set"} />
        {invoice.placeOfSupply ? <Line label="Place of supply" value={String(invoice.placeOfSupply)} /> : null}
        {invoice.notes ? <Text style={styles.notes}>{String(invoice.notes)}</Text> : null}
        {s.projectId ? (
          <Pressable style={styles.link} onPress={() => nav.project(s.projectId)} accessibilityRole="button">
            <View style={styles.linkIcon}>
              <FolderKanban size={16} color={p.clayDark} />
            </View>
            <Text style={styles.linkText} numberOfLines={1}>
              {String(invoice.title || "Open project")}
            </Text>
            <ChevronRight size={16} color={p.faint} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.section}>PDF preview</Text>
      {previewQ.isLoading || previewQ.isFetching ? (
        <View style={styles.previewLoading}>
          <ActivityIndicator color={p.clay} />
          <Text style={styles.previewText}>{previewQ.data ? "Updating preview…" : "Preparing preview…"}</Text>
        </View>
      ) : null}
      {previewQ.isError ? (
        <ErrorBanner message={(previewQ.error as { userMessage?: string })?.userMessage || "Couldn't render the PDF preview."} onRetry={() => previewQ.refetch()} />
      ) : null}
      {(previewQ.data?.pages || []).map((page) => {
        const aspect = page.height > 0 && page.width > 0 ? page.height / page.width : 1.414;
        return (
          <View key={page.page} style={styles.page}>
            <Image
              source={{ uri: `data:${page.mimeType || "image/png"};base64,${page.imageBase64}` }}
              style={{ width: pageWidth - 12, height: (pageWidth - 12) * aspect }}
              resizeMode="contain"
            />
          </View>
        );
      })}

      {s.status !== "void" && s.paid > 0 && s.status !== "paid" ? (
        <Text style={styles.hint}>An invoice with payments can't be voided. Delete its payments first.</Text>
      ) : null}
    </View>
  );
}

export function InvoiceActions({ id, nav, enabled = true }: { id: string; nav: InvoiceNav; enabled?: boolean }) {
  const s = useInvoiceState(id, enabled);
  const send = useSendInvoice();
  const voidInvoice = useVoidInvoice();
  const ensurePdf = useEnsureInvoicePdf();
  const [busy, setBusy] = useState<string | null>(null);
  if (!s.invoice) return null;
  const invoice = s.invoice;
  const pending = Boolean(busy);
  const pid = s.projectId || undefined;

  async function markSent() {
    setBusy("send");
    try {
      const result = await send.mutateAsync(id);
      const mail = (result.emailResult as Row | undefined) || {};
      if (mail.skipped) {
        Toast.show({ type: "info", text1: "Marked as sent", text2: s.email ? "Email isn't set up yet, so share it on WhatsApp instead." : "The customer has no email; share it on WhatsApp instead." });
      } else if (mail.error) {
        Toast.show({ type: "error", text1: "Marked as sent, but the email failed", text2: "Share it on WhatsApp instead." });
      } else {
        Toast.show({ type: "success", text1: "Invoice emailed", text2: s.email || undefined });
      }
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't send invoice", text2: errorText(e) });
    } finally {
      setBusy(null);
    }
  }

  function email() {
    if (!s.email) {
      Toast.show({ type: "info", text1: "No email on file", text2: "Add the customer's email to send invoices." });
      return;
    }
    Alert.alert("Email invoice?", `${s.number} will be emailed to ${s.email}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: () => void markSent() },
    ]);
  }

  async function pdfLink() {
    let url = normalizePdfUrl(String(invoice.pdfUrl || ""));
    if (!url || url.includes("/raw/upload/")) {
      try {
        const updated = await ensurePdf.mutateAsync(id);
        url = normalizePdfUrl(String(updated.pdfUrl || "")) || url;
      } catch {
        /* Share without a link; the customer still gets the message. */
      }
    }
    return url;
  }

  async function whatsapp() {
    setBusy("whatsapp");
    try {
      const url = await pdfLink();
      const name = s.customer?.name ? ` ${s.customer.name}` : "";
      const message =
        s.outstanding > 0 && s.status !== "draft"
          ? `Hello${name}, a gentle reminder that ${formatCurrency(s.outstanding)} is due on invoice ${s.number}${invoice.dueDate ? ` (due ${formatDate(String(invoice.dueDate))})` : ""}.${url ? `\nPDF: ${url}` : ""}\nThank you.`
          : `Hello${name}, please find invoice ${s.number} for ${formatCurrency(s.total)}.${url ? `\nPDF: ${url}` : ""}`;
      await shareViaWhatsApp({ phone: s.phone, message });
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't open WhatsApp", text2: (e as Error)?.message || "Is WhatsApp installed?" });
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy("share");
    try {
      await shareApiFile(`/invoices/${id}/pdf-file`, `${s.number}.pdf`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't share PDF", text2: (e as Error)?.message || "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  function confirmVoid() {
    Alert.alert(
      `Void invoice ${s.number}?`,
      `${formatCurrency(s.total)} will be removed from the project's billed amount. A void invoice can't be edited or paid.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Void invoice",
          style: "destructive",
          onPress: async () => {
            setBusy("void");
            try {
              await voidInvoice.mutateAsync(id);
              Toast.show({ type: "success", text1: "Invoice voided", text2: s.number });
            } catch (e) {
              Toast.show({ type: "error", text1: "Couldn't void invoice", text2: errorText(e) });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const edit = s.canEdit ? <Secondary label="Edit" icon={<Pencil size={16} color={p.text} />} disabled={pending} onPress={() => nav.edit(id, pid)} /> : null;

  return (
    <View style={{ gap: 10 }}>
      {s.status === "draft" ? (
        <View style={styles.rowGap}>
          <Primary label="Mark as sent" busy={busy === "send"} disabled={pending} icon={<Send size={18} color="#fff" />} onPress={() => void markSent()} flex />
          {edit}
        </View>
      ) : s.outstanding > 0 ? (
        <View style={styles.rowGap}>
          <Primary label="Record payment" disabled={pending} icon={<Wallet size={18} color="#fff" />} onPress={() => nav.recordPayment(id, pid)} flex />
          {edit}
        </View>
      ) : s.status === "paid" && pid ? (
        <Primary label="View project" icon={<FolderKanban size={18} color="#fff" />} onPress={() => nav.project(pid)} />
      ) : s.status === "paid" ? (
        <View style={styles.settled}>
          <CheckCircle2 size={18} color="#15803D" />
          <Text style={styles.settledText}>Paid in full</Text>
        </View>
      ) : null}
      <View style={styles.iconRow}>
        <IconBtn label="Share PDF" onPress={sharePdf} busy={busy === "share"} disabled={pending} icon={<Share2 size={18} color={p.text} />} />
        <IconBtn
          label={s.outstanding > 0 && s.status !== "draft" ? "Remind" : "WhatsApp"}
          onPress={whatsapp}
          busy={busy === "whatsapp"}
          disabled={pending || s.status === "void"}
          icon={<MessageCircle size={18} color="#15803D" />}
        />
        {s.canSend ? <IconBtn label="Email" onPress={email} busy={busy === "send"} disabled={pending} icon={<Mail size={18} color={p.text} />} /> : null}
        <IconBtn
          label="Call"
          onPress={() => Linking.openURL(`tel:${s.phone.replace(/[^\d+]/g, "")}`)}
          disabled={pending || !s.phone}
          icon={<Phone size={18} color={p.clayDark} />}
        />
        {s.canVoid ? <IconBtn label="Void" onPress={confirmVoid} busy={busy === "void"} disabled={pending} danger icon={<Ban size={18} color={p.red} />} /> : null}
      </View>
    </View>
  );
}

function MoneyCell({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <View style={styles.moneyCell}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, tone === "red" && { color: p.red }, tone === "green" && { color: "#15803D" }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[styles.line, strong && styles.lineStrong]}>
      <Text style={[styles.lineLabel, strong && styles.lineLabelStrong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineValueStrong]}>{value}</Text>
    </View>
  );
}

function Primary({ label, icon, onPress, busy, disabled, flex }: { label: string; icon: React.ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean; flex?: boolean }) {
  return (
    <Pressable style={[styles.primary, flex && { flex: 1 }, disabled && !busy && styles.dim]} onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon}
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function Secondary({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={[styles.secondary, disabled && styles.dim]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      {icon}
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

function IconBtn({ label, icon, onPress, busy, disabled, danger }: { label: string; icon: React.ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      style={[styles.iconBtn, danger && styles.iconDanger, disabled && !busy && styles.dim]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? <ActivityIndicator size="small" color={p.clay} /> : icon}
      <Text style={[styles.iconText, danger && { color: p.red }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, padding: spacing.md },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tile: { width: 48, height: 48, borderRadius: 16, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  heroLabel: { color: p.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  heroValue: { color: p.text, fontSize: 26, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  heroMeta: { color: p.muted, fontSize: 12, marginTop: 3 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "800" },
  track: { height: 6, borderRadius: 3, backgroundColor: p.slateSoft, overflow: "hidden", marginTop: 14 },
  fill: { height: 6, borderRadius: 3, backgroundColor: "#16A34A" },
  trackText: { color: p.muted, fontSize: 12, fontWeight: "600", marginTop: 6 },
  money: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: p.border },
  moneyCell: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  moneySep: { width: 1, backgroundColor: p.border },
  moneyLabel: { color: p.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  moneyValue: { color: p.text, fontWeight: "800", marginTop: 4, fontSize: 15 },
  next: { borderRadius: radius.md, padding: 12, borderWidth: 1 },
  nextLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  nextText: { color: p.text, fontSize: 14, marginTop: 4, lineHeight: 20 },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 6 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: p.text, fontSize: 15, fontWeight: "800", marginBottom: 6 },
  cardAction: { color: p.clayDark, fontWeight: "800", marginBottom: 6 },
  muted: { color: p.muted, fontSize: 13, marginBottom: 10 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: p.border },
  itemTitle: { color: p.text, fontSize: 14, fontWeight: "700" },
  itemSub: { color: p.muted, fontSize: 12, marginTop: 2 },
  itemAmt: { color: p.text, fontSize: 14, fontWeight: "800" },
  payIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: p.greenSoft, alignItems: "center", justifyContent: "center" },
  totals: { borderTopWidth: 1, borderTopColor: p.border, paddingTop: 4 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 },
  lineStrong: { borderTopWidth: 1, borderTopColor: p.border, marginTop: 2, paddingTop: 10 },
  lineLabel: { color: p.muted, fontSize: 14 },
  lineLabelStrong: { color: p.text, fontWeight: "800" },
  lineValue: { color: p.text, fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  lineValueStrong: { fontWeight: "800", fontSize: 16 },
  notes: { color: p.text, fontSize: 14, lineHeight: 20, paddingVertical: 8, borderTopWidth: 1, borderTopColor: p.border },
  link: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: p.border },
  linkIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: p.claySoft, alignItems: "center", justifyContent: "center" },
  linkText: { flex: 1, color: p.text, fontSize: 14, fontWeight: "700" },
  section: { color: p.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  previewLoading: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border },
  previewText: { color: p.muted, fontWeight: "600" },
  page: { backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 6, alignItems: "center" },
  hint: { color: p.muted, fontSize: 12, textAlign: "center" },
  rowGap: { flexDirection: "row", gap: 8 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderStrong,
  },
  secondaryText: { color: p.text, fontWeight: "700" },
  settled: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: radius.md, backgroundColor: p.greenSoft },
  settledText: { color: "#15803D", fontWeight: "800", fontSize: 15 },
  iconRow: { flexDirection: "row", gap: 8 },
  iconBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: p.background,
    borderWidth: 1,
    borderColor: p.border,
  },
  iconDanger: { backgroundColor: p.redSoft, borderColor: "#FECACA" },
  iconText: { color: p.text, fontSize: 11, fontWeight: "700" },
  dim: { opacity: 0.45 },
});
