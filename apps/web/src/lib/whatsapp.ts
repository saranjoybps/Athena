export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function shareViaWhatsApp({ phone, message }: { phone: string; message: string }) {
  const normalized = normalizeWhatsAppPhone(phone);
  const text = encodeURIComponent(message);
  const url = normalized ? `https://wa.me/${normalized}?text=${text}` : `https://wa.me/?text=${text}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return url;
}

/**
 * Best-effort WhatsApp PDF share without a PDF library:
 * 1) opens the print/save-as-PDF dialog for the document
 * 2) opens WhatsApp with a message asking the customer to receive the estimate/invoice
 * 3) returns guidance for attaching the saved PDF in WhatsApp
 */
export async function shareDocumentViaWhatsApp({
  phone,
  message,
  printFn,
}: {
  phone: string;
  message: string;
  printFn: () => Promise<void>;
}) {
  await printFn();
  const tip =
    "PDF print/save dialog opened. Save the PDF, then attach that file in WhatsApp.";
  const fullMessage = `${message}\n\n(PDF attached separately)`;
  shareViaWhatsApp({ phone, message: fullMessage });
  return tip;
}
