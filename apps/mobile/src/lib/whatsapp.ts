import { Linking } from "react-native";

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function whatsAppUrl({ phone, message }: { phone?: string | null; message: string }) {
  const normalized = normalizeWhatsAppPhone(phone || "");
  const text = encodeURIComponent(message);
  return normalized ? `https://wa.me/${normalized}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Opens WhatsApp (app or web) with a prefilled message for the customer. */
export async function shareViaWhatsApp({
  phone,
  message,
}: {
  phone?: string | null;
  message: string;
}) {
  const url = whatsAppUrl({ phone, message });
  const can = await Linking.canOpenURL(url);
  if (!can) {
    throw new Error("WhatsApp is not available on this device");
  }
  await Linking.openURL(url);
  return url;
}
