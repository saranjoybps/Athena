import { Alert } from "react-native";
import Toast from "react-native-toast-message";

type Counts = Record<string, number | undefined>;

const LABELS: [key: string, one: string, many: string][] = [
  ["sites", "site", "sites"],
  ["surveys", "survey", "surveys"],
  ["measurements", "measurement", "measurements"],
  ["estimates", "estimate", "estimates"],
  ["files", "file", "files"],
];

/** "2 sites, 1 survey and 3 estimates" — only non-zero counts. */
export function describeCounts(counts: Counts, keys: string[] = LABELS.map((l) => l[0])) {
  const parts = LABELS.filter(([key]) => keys.includes(key))
    .map(([key, one, many]) => {
      const n = Number(counts[key] || 0);
      return n > 0 ? `${n} ${n === 1 ? one : many}` : "";
    })
    .filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** `entity` names what is being deleted ("estimate", "survey") so the title and button never say just "Delete". */
export function confirmDestructive(opts: {
  entity?: string;
  name?: string;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const title = opts.title || `Delete ${opts.entity || "item"}${opts.name ? ` ${opts.name}` : ""}?`;
  const confirm = opts.confirmLabel || (opts.entity ? `Delete ${opts.entity}` : "Delete");
  Alert.alert(title, opts.message, [
    { text: "Cancel", style: "cancel" },
    { text: confirm, style: "destructive", onPress: opts.onConfirm },
  ]);
}

type ApiError = { userMessage?: string; response?: { status?: number } };

/** 409s explain why a record is locked (invoices, payments, projects) — show them as a dialog, not a toast. */
export function showDeleteError(entity: string, e: unknown) {
  const err = e as ApiError;
  const message = err?.userMessage || "Please try again.";
  if (err?.response?.status === 409) {
    Alert.alert(`Can't delete ${entity}`, message);
    return;
  }
  Toast.show({ type: "error", text1: `Couldn't delete ${entity}`, text2: message });
}
