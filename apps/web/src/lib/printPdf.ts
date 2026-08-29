"use client";

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 10mm; }
  html, body { margin: 0; padding: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  #document-pdf-content { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
  div { page-break-inside: avoid; }
  table { page-break-inside: auto; }
  thead { display: table-header-group; }
`;

export async function printDocumentElement(el: HTMLElement): Promise<void> {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.width = "100%";
  clone.style.margin = "0";
  clone.style.boxSizing = "border-box";

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    document.body.removeChild(iframe);
    throw new Error("Unable to open print window");
  }

  const doc = win.document;
  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${PRINT_STYLES}</style></head><body>${clone.outerHTML}</body></html>`,
  );
  doc.close();

  await Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : typeof img.decode === "function"
          ? img.decode().catch(() => undefined)
          : Promise.resolve(),
    ),
  );

  try {
    win.focus();
    win.print();
  } finally {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  }
}
