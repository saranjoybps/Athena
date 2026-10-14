import { Banknote, CreditCard, Landmark, ScrollText, Smartphone } from "lucide-react-native";

export const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "bank", label: "Bank transfer", icon: Landmark },
  { id: "cheque", label: "Cheque", icon: ScrollText },
  { id: "card", label: "Card", icon: CreditCard },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];

export function methodMeta(method: unknown) {
  return PAYMENT_METHODS.find((m) => m.id === String(method || "").toLowerCase()) ?? PAYMENT_METHODS[0];
}

export function errorText(e: unknown) {
  return (e as { userMessage?: string })?.userMessage || "Please try again.";
}
