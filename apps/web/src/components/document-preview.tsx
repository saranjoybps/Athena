"use client";

import { useRef, useState } from "react";
import { DefaultDocumentPdf } from "@/components/default-document-pdf";
import { resolveDocumentBranding, type AthenaDocument } from "@/lib/documentBranding";
import { printDocumentElement } from "@/lib/printPdf";
import { athena } from "@/lib/athena-client";
import { API_URL } from "@/lib/api";
import { getIdToken } from "@/lib/firebase";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { loadSession } from "@/lib/session";

type Props = {
  doc: AthenaDocument;
  kind: "quotation" | "invoice";
  /** Called after a PDF is generated/refreshed so parent can reload. */
  onPdfReady?: (pdfUrl: string) => void;
};

/** PDF preview only — Email / WhatsApp live in DocumentSendActions. */
export function DocumentPreview({ doc, kind, onPdfReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [livePdfUrl, setLivePdfUrl] = useState(
    normalizePdfUrl(String((doc as Record<string, unknown>).pdfUrl || "")),
  );
  const branding = resolveDocumentBranding(doc);
  const pdfUrl = livePdfUrl || normalizePdfUrl(String((doc as Record<string, unknown>).pdfUrl || ""));

  async function refreshCloudinaryPdf(): Promise<string> {
    const id = String(doc.id || "");
    if (!id) return "";
    const updated =
      kind === "invoice"
        ? ((await athena.invoices.pdf(id)) as Record<string, unknown>)
        : ((await athena.quotes.pdf(id)) as Record<string, unknown>);
    const url = normalizePdfUrl(String(updated.pdfUrl || ""));
    if (url) {
      setLivePdfUrl(url);
      onPdfReady?.(url);
    }
    return url;
  }

  async function openApiPdfPreview(): Promise<boolean> {
    const id = String(doc.id || "");
    if (!id) return false;
    const session = loadSession();
    const token = await getIdToken();
    if (!token) return false;
    const path =
      kind === "invoice" ? `/api/v1/invoices/${id}/pdf-file` : `/api/v1/quotes/${id}/pdf-file`;
    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(session?.orgId ? { "X-Organization-Id": session.orgId } : {}),
      },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  async function handlePrint() {
    setPrinting(true);
    try {
      // Prefer API-served PDF bytes (works even when Cloudinary PDF delivery is blocked).
      const opened = await openApiPdfPreview();
      if (opened) {
        void refreshCloudinaryPdf();
        return;
      }
      const url = await refreshCloudinaryPdf();
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      const el = ref.current?.querySelector("#document-pdf-content") as HTMLElement | null;
      if (!el) return;
      await printDocumentElement(el);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          Preview opens the PDF from Athena (in a new tab). Cloudinary is still used for share links.
        </p>
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {printing ? "Preparing…" : "Preview PDF"}
        </button>
      </div>
      <div ref={ref} className="overflow-x-auto rounded-2xl border bg-stone-100 p-4">
        <DefaultDocumentPdf doc={doc} branding={branding} customer={doc.customer} kind={kind} />
      </div>
    </div>
  );
}
