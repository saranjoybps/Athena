"use client";

import { useRef, useState } from "react";
import { DefaultDocumentPdf } from "@/components/default-document-pdf";
import { resolveDocumentBranding, type AthenaDocument } from "@/lib/documentBranding";
import { printDocumentElement } from "@/lib/printPdf";

type Props = {
  doc: AthenaDocument;
  kind: "quotation" | "invoice";
};

export function DocumentPreview({ doc, kind }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const branding = resolveDocumentBranding(doc);

  async function handlePrint() {
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Preview and download as PDF via print dialog.</p>
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {printing ? "Preparing…" : "Download PDF"}
        </button>
      </div>
      <div ref={ref} className="overflow-x-auto rounded-2xl border bg-stone-100 p-4">
        <DefaultDocumentPdf doc={doc} branding={branding} customer={doc.customer} kind={kind} />
      </div>
    </div>
  );
}
