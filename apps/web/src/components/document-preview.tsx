"use client";

import { useRef, useState } from "react";
import { DefaultDocumentPdf } from "@/components/default-document-pdf";
import { resolveDocumentBranding, type AthenaDocument } from "@/lib/documentBranding";
import { printDocumentElement } from "@/lib/printPdf";
import { athena } from "@/lib/athena-client";

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
  const [livePdfUrl, setLivePdfUrl] = useState(String((doc as Record<string, unknown>).pdfUrl || ""));
  const branding = resolveDocumentBranding(doc);
  const pdfUrl = livePdfUrl || String((doc as Record<string, unknown>).pdfUrl || "");

  async function ensureCloudinaryPdf(): Promise<string> {
    if (pdfUrl) return pdfUrl;
    const id = String(doc.id || "");
    if (!id) return "";
    setPrinting(true);
    try {
      const updated =
        kind === "invoice"
          ? ((await athena.invoices.pdf(id)) as Record<string, unknown>)
          : ((await athena.quotes.pdf(id)) as Record<string, unknown>);
      const url = String(updated.pdfUrl || "");
      if (url) {
        setLivePdfUrl(url);
        onPdfReady?.(url);
      }
      return url;
    } finally {
      setPrinting(false);
    }
  }

  async function handlePrint() {
    const url = await ensureCloudinaryPdf();
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const el = ref.current?.querySelector("#document-pdf-content") as HTMLElement | null;
    if (!el) return;
    setPrinting(true);
    try {
      await printDocumentElement(el);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          {pdfUrl
            ? "Stored PDF available from Cloudinary — Open PDF uses that URL."
            : "Open PDF will generate and upload to Cloudinary, then open the stored URL."}
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
