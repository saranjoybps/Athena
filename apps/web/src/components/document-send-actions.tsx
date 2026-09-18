"use client";

import { useState } from "react";
import { athena } from "@/lib/athena-client";
import { shareViaWhatsApp } from "@/lib/whatsapp";

type Kind = "quotation" | "invoice";

type Props = {
  kind: Kind;
  docId: string;
  number?: string | null;
  pdfUrl?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** Called after a successful email send (doc reloaded by parent). */
  onSent?: (result: Record<string, unknown>) => void;
  /** Called when PDF is generated for WhatsApp. */
  onPdfReady?: (pdfUrl: string) => void;
};

function labelFor(kind: Kind) {
  return kind === "invoice" ? "Invoice" : "Quotation";
}

export function DocumentSendActions({
  kind,
  docId,
  number,
  pdfUrl,
  customerPhone,
  customerEmail,
  onSent,
  onPdfReady,
}: Props) {
  const [emailBusy, setEmailBusy] = useState(false);
  const [waBusy, setWaBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const email = (customerEmail || "").trim();
  const hasEmail = Boolean(email);

  async function ensurePdf(): Promise<string> {
    if (pdfUrl) return String(pdfUrl);
    const updated =
      kind === "invoice"
        ? ((await athena.invoices.pdf(docId)) as Record<string, unknown>)
        : ((await athena.quotes.pdf(docId)) as Record<string, unknown>);
    const url = String(updated.pdfUrl || "");
    if (url) onPdfReady?.(url);
    return url;
  }

  async function sendEmail() {
    if (!hasEmail) {
      setHint("Add an email on the customer record to send by email.");
      return;
    }
    setEmailBusy(true);
    setHint(null);
    try {
      const result =
        kind === "invoice"
          ? ((await athena.invoices.send(docId)) as Record<string, unknown>)
          : ((await athena.quotes.send(docId)) as Record<string, unknown>);
      const mail = (result.emailResult as Record<string, unknown> | undefined) || {};
      if (mail.skipped) {
        const reason = String(mail.reason || "");
        setHint(
          reason === "smtp_not_configured"
            ? "Marked sent. SMTP is not configured — email was skipped."
            : reason === "no_email"
              ? "Marked sent. Customer has no email."
              : "Marked sent. Email was skipped.",
        );
      } else if (mail.error) {
        setHint(`Marked sent, but email failed: ${String(mail.error)}`);
      } else if (mail.sent) {
        setHint(`Email sent to ${email}.`);
      } else {
        setHint("Marked as sent.");
      }
      onSent?.(result);
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setEmailBusy(false);
    }
  }

  async function sendWhatsApp() {
    setWaBusy(true);
    setHint(null);
    try {
      const url = await ensurePdf();
      const docLabel = labelFor(kind);
      const num = number ? String(number) : docId;
      const message = [
        `${docLabel} ${num} from Athena.`,
        url ? `PDF: ${url}` : "PDF link will follow once generated.",
      ].join("\n");
      shareViaWhatsApp({ phone: customerPhone || "", message });
      if (!customerPhone) {
        setHint("WhatsApp opened — pick a chat (customer has no phone on file).");
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Could not open WhatsApp");
    } finally {
      setWaBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Send to customer</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendEmail}
          disabled={emailBusy || !hasEmail}
          title={hasEmail ? `Email ${email}` : "Add email on the customer record"}
          className="rounded-xl bg-clay px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {emailBusy ? "Sending…" : "Email"}
        </button>
        <button
          type="button"
          onClick={sendWhatsApp}
          disabled={waBusy}
          className="rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-50"
        >
          {waBusy ? "Preparing…" : "WhatsApp"}
        </button>
      </div>
      {!hasEmail ? (
        <p className="mt-2 text-sm text-stone-500">Email disabled — add an email on the customer.</p>
      ) : null}
      {hint ? <p className="mt-2 text-sm text-stone-700">{hint}</p> : null}
    </div>
  );
}
