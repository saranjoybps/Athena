import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Toast from "react-native-toast-message";
import {
  CheckCircle2,
  FolderKanban,
  Mail,
  MessageCircle,
  Pencil,
  RotateCcw,
  Share2,
  Trash2,
  XCircle,
} from "lucide-react-native";
import {
  useCreateProjectFromQuote,
  useDeleteEstimate,
  useEstimate,
  useEstimatePreview,
  useEstimateWorkflow,
  useQuoteAction,
} from "@/hooks/useApi";
import { StatusPill } from "@/components/customers/WorkflowRows";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { confirmDestructive, showDeleteError } from "@/lib/confirm";
import { shareApiFile } from "@/lib/files";
import { formatCurrency, formatDate } from "@/lib/format";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { estimateStatusFromQuote, type EstimateStatus } from "@/lib/workflow";
import { lightPalette as p, radius, spacing } from "@/lib/theme";

type Contact = { phone?: string | null; email?: string | null };

export type EstimateNav = {
  edit: (id: string) => void;
  project: (projectId: string) => void;
  /** Called after the estimate was deleted. */
  deleted: () => void;
};

const NEXT_STEP: Record<EstimateStatus, string> = {
  draft: "Review the PDF, then send it to the customer and record their decision.",
  sent: "Waiting for the customer. Mark it approved or rejected once they decide.",
  changes_requested: "The customer asked for changes. Edit the estimate — the PDF updates automatically — then send it again.",
  approved: "Approved. Start the project to schedule work, track costs and raise invoices.",
  rejected: "The customer rejected this estimate. Create a new estimate for the site if they want a revised offer.",
};

/** Everything needed to show and act on one estimate. */
export function useEstimateState(id: string | undefined, enabled = true) {
  const estimateQ = useEstimate(enabled ? id : undefined);
  const workflowQ = useEstimateWorkflow(id, enabled);
  const estimate = estimateQ.data;
  const quote = workflowQ.data?.quote || null;
  const project = workflowQ.data?.project || null;
  const status = estimateStatusFromQuote(quote?.status, estimate?.status);
  const locked = Boolean(project) || status === "approved" || status === "rejected";
  return { estimateQ, workflowQ, estimate, quote, project, status, locked };
}

export function EstimateBody({ id, enabled = true }: { id: string; enabled?: boolean }) {
  const { width } = useWindowDimensions();
  const { estimateQ, workflowQ, estimate, project, status } = useEstimateState(id, enabled);
  const previewQ = useEstimatePreview(id, estimate?.version, enabled && Boolean(estimate));
  const computed = (estimate?.computed as Record<string, unknown>) || {};
  const tax = (computed.tax as Record<string, string>) || {};
  const pageWidth = width - spacing.lg * 2 - 2;

  if (estimateQ.isLoading) return <ActivityIndicator color={p.clay} style={{ marginVertical: 32 }} />;
  if (estimateQ.isError || !estimate) {
    return (
      <ErrorBanner
        message={(estimateQ.error as { userMessage?: string })?.userMessage || "Couldn't load this estimate."}
        onRetry={() => estimateQ.refetch()}
      />
    );
  }

  const discount = Number(computed.discount || 0);
  const rows: [string, unknown][] = [
    ["Work", computed.workTotal],
    ["Materials", computed.materialTotal],
    ["Tool charges", computed.toolTotal],
  ];
  const hasBreakdown = rows.some(([, v]) => Number(v || 0) > 0);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>Estimate total</Text>
          <Text style={styles.heroValue}>{formatCurrency(String(computed.grandTotal || estimate.total || 0))}</Text>
          <Text style={styles.heroMeta}>
            {[estimate.number, `v${estimate.version || 1}`, estimate.updatedAt ? `Updated ${formatDate(String(estimate.updatedAt))}` : ""]
              .filter(Boolean)
              .map(String)
              .join(" · ")}
          </Text>
        </View>
        {workflowQ.isLoading ? <ActivityIndicator color={p.clay} /> : <StatusPill status={status} />}
      </View>

      <View style={styles.next}>
        <Text style={styles.nextLabel}>Next step</Text>
        <Text style={styles.nextText}>
          {project ? `Project ${project.number || project.name || ""} is running from this estimate.`.replace("  ", " ") : NEXT_STEP[status]}
        </Text>
      </View>

      <View style={styles.card}>
        {hasBreakdown
          ? rows
              .filter(([, v]) => Number(v || 0) > 0)
              .map(([label, v]) => <Line key={label} label={label} value={formatCurrency(String(v))} />)
          : null}
        {discount > 0 ? <Line label="Discount" value={`− ${formatCurrency(discount)}`} /> : null}
        <Line label="Taxable amount" value={formatCurrency(String(computed.subtotal || computed.selling || 0))} />
        {Number(tax.taxTotal || 0) > 0 ? <Line label={`GST ${Math.round(Number(tax.rate || 0) * 100)}%`} value={formatCurrency(tax.taxTotal)} /> : null}
        <Line label="Grand total" value={formatCurrency(String(computed.grandTotal || 0))} strong />
      </View>

      <Text style={styles.section}>PDF preview</Text>
      {previewQ.isLoading || previewQ.isFetching ? (
        <View style={styles.previewLoading}>
          <ActivityIndicator color={p.clay} />
          <Text style={styles.previewText}>{previewQ.data ? "Updating preview…" : "Preparing preview…"}</Text>
        </View>
      ) : null}
      {previewQ.isError ? (
        <ErrorBanner
          message={(previewQ.error as { userMessage?: string })?.userMessage || "Couldn't render the PDF preview."}
          onRetry={() => previewQ.refetch()}
        />
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

export function EstimateActions({ id, contact, nav, enabled = true }: { id: string; contact?: Contact; nav: EstimateNav; enabled?: boolean }) {
  const { estimate, quote, project, status, locked } = useEstimateState(id, enabled);
  const quoteAction = useQuoteAction();
  const createProject = useCreateProjectFromQuote();
  const del = useDeleteEstimate();
  const [busy, setBusy] = useState<string | null>(null);
  if (!estimate) return null;
  const number = String(estimate.number || "Estimate");

  async function decide(action: "send" | "accept" | "reject" | "request-modification") {
    if (!quote?.id) {
      Toast.show({ type: "error", text1: "Estimate not ready", text2: "Pull to refresh and try again." });
      return;
    }
    setBusy(action);
    try {
      await quoteAction.mutateAsync({ id: quote.id, action });
      const copy = {
        send: ["Estimate emailed", `Sent ${number} to ${contact?.email || "the customer"}.`],
        accept: ["Estimate approved", "Start the project when you're ready."],
        reject: ["Estimate rejected", `${number} is marked as rejected.`],
        "request-modification": ["Reopened for changes", "Edit the estimate and send it again."],
      }[action];
      Toast.show({ type: action === "reject" ? "info" : "success", text1: copy[0], text2: copy[1] });
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't update estimate", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  const contractValue = formatCurrency(String((estimate.computed as Record<string, string>)?.grandTotal || 0));

  function confirmStartProject() {
    if (!quote?.id) {
      Toast.show({ type: "error", text1: "Estimate not ready", text2: "Pull to refresh and try again." });
      return;
    }
    const name = String(estimate?.title || "") || number;
    Alert.alert(
      "Start project?",
      `A project "${name}" will be created from estimate ${number}.\n\nContract value: ${contractValue}\n\nWork lines become the project's work packages and the estimate is locked from further edits.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start project", onPress: () => void startProject() },
      ],
    );
  }

  async function startProject() {
    if (!quote?.id) return;
    setBusy("project");
    try {
      const proj = await createProject.mutateAsync({ quoteId: quote.id, name: String(estimate?.title || "") || undefined });
      Toast.show({ type: "success", text1: "Project started", text2: `Contract value ${contractValue} — next, plan the schedule and crew.` });
      nav.project(String(proj.id));
    } catch (e) {
      const err = (e as { response?: { data?: { error?: { code?: string; details?: { projectId?: string } } } } })?.response?.data?.error;
      if (err?.code === "project_exists" && err.details?.projectId) {
        Toast.show({ type: "info", text1: "Project already started", text2: "Opening the project made from this estimate." });
        nav.project(String(err.details.projectId));
        return;
      }
      Toast.show({ type: "error", text1: "Couldn't start project", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function sharePdf() {
    setBusy("share");
    try {
      await shareApiFile(`/estimates/${id}/pdf-file`, `${number}.pdf`);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't share PDF", text2: (e as Error)?.message || "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function whatsapp() {
    const url = normalizePdfUrl(String(estimate?.pdfUrl || quote?.pdfUrl || ""));
    try {
      await shareViaWhatsApp({
        phone: contact?.phone,
        message: [`Estimate ${number} from Athena.`, url ? `PDF: ${url}` : ""].filter(Boolean).join("\n"),
      });
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't open WhatsApp", text2: (e as Error)?.message || "Is WhatsApp installed?" });
    }
  }

  function email() {
    if (!contact?.email) {
      Toast.show({ type: "info", text1: "No email on file", text2: "Add the customer's email to send estimates." });
      return;
    }
    Alert.alert("Email estimate?", `${number} will be emailed to ${contact.email}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: () => void decide("send") },
    ]);
  }

  function remove() {
    confirmDestructive({
      entity: "estimate",
      name: estimate?.number ? number : undefined,
      message: `This estimate and its PDF will be permanently deleted. The site's surveys and measurements stay as they are.`,
      onConfirm: async () => {
        setBusy("delete");
        try {
          await del.mutateAsync(id);
          Toast.show({ type: "success", text1: "Estimate deleted", text2: number });
          nav.deleted();
        } catch (e) {
          showDeleteError("estimate", e);
        } finally {
          setBusy(null);
        }
      },
    });
  }

  const pending = Boolean(busy);
  const open = status === "draft" || status === "sent" || status === "changes_requested";
  return (
    <View style={{ gap: 10 }}>
      {project ? (
        <Primary label="View project" icon={<FolderKanban size={18} color="#fff" />} onPress={() => nav.project(project.id)} />
      ) : status === "approved" ? (
        <View style={styles.rowGap}>
          <Primary label="Start project" busy={busy === "project"} disabled={pending} icon={<FolderKanban size={18} color="#fff" />} onPress={confirmStartProject} flex />
          <Secondary label="Reopen" icon={<RotateCcw size={16} color={p.text} />} disabled={pending} busy={busy === "request-modification"} onPress={() => decide("request-modification")} />
        </View>
      ) : open ? (
        <View style={styles.rowGap}>
          <Primary label="Approve" busy={busy === "accept"} disabled={pending} icon={<CheckCircle2 size={18} color="#fff" />} onPress={() => decide("accept")} flex />
          <Secondary label="Reject" icon={<XCircle size={16} color={p.red} />} danger disabled={pending} busy={busy === "reject"} onPress={() => decide("reject")} />
          <Secondary label="Edit" icon={<Pencil size={16} color={p.text} />} disabled={pending || locked} onPress={() => nav.edit(id)} />
        </View>
      ) : null}
      <View style={styles.iconRow}>
        <IconBtn label="Share PDF" onPress={sharePdf} busy={busy === "share"} disabled={pending} icon={<Share2 size={18} color={p.text} />} />
        <IconBtn label="WhatsApp" onPress={whatsapp} disabled={pending} icon={<MessageCircle size={18} color="#15803D" />} />
        <IconBtn label="Email" onPress={email} busy={busy === "send"} disabled={pending} icon={<Mail size={18} color={p.text} />} />
        {!project ? <IconBtn label="Delete" onPress={remove} busy={busy === "delete"} disabled={pending} danger icon={<Trash2 size={18} color={p.red} />} /> : null}
      </View>
    </View>
  );
}

function Primary({ label, icon, onPress, busy, disabled, flex }: { label: string; icon: React.ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean; flex?: boolean }) {
  return (
    <Pressable style={[styles.primary, flex && { flex: 1 }, disabled && !busy && styles.dim]} onPress={onPress} disabled={disabled || busy}>
      {busy ? <ActivityIndicator color="#fff" /> : (
        <>
          {icon}
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function Secondary({ label, icon, onPress, busy, disabled, danger }: { label: string; icon: React.ReactNode; onPress: () => void; busy?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable style={[styles.secondary, danger && styles.secondaryDanger, disabled && !busy && styles.dim]} onPress={onPress} disabled={disabled || busy}>
      {busy ? <ActivityIndicator color={danger ? p.red : p.clay} /> : (
        <>
          {icon}
          <Text style={[styles.secondaryText, danger && { color: p.red }]}>{label}</Text>
        </>
      )}
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
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
  },
  heroLabel: { color: p.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  heroValue: { color: p.text, fontSize: 28, fontWeight: "800", marginTop: 2, letterSpacing: -0.5 },
  heroMeta: { color: p.muted, fontSize: 12, marginTop: 4 },
  next: { backgroundColor: p.claySoft, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: p.clayMid },
  nextLabel: { color: p.clayDark, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  nextText: { color: p.text, fontSize: 14, marginTop: 4, lineHeight: 20 },
  card: { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border, paddingHorizontal: spacing.md, paddingVertical: 4 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9 },
  lineStrong: { borderTopWidth: 1, borderTopColor: p.border, marginTop: 2, paddingTop: 11 },
  lineLabel: { color: p.muted, fontSize: 14 },
  lineLabelStrong: { color: p.text, fontWeight: "800" },
  lineValue: { color: p.text, fontSize: 14, fontWeight: "600" },
  lineValueStrong: { fontWeight: "800", fontSize: 16 },
  section: { color: p.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 4 },
  previewLoading: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border },
  previewText: { color: p.muted, fontWeight: "600" },
  page: { backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, padding: 6, alignItems: "center" },
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
    paddingHorizontal: 14,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.borderStrong,
  },
  secondaryDanger: { borderColor: "#FECACA", backgroundColor: p.redSoft },
  secondaryText: { color: p.text, fontWeight: "700" },
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
