import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Alert, Linking, Platform } from "react-native";
import { getApiBaseUrl } from "@/lib/config";
import { getIdToken } from "@/lib/firebase";
import { useAuthStore } from "@/store";

export type PickedFile = { uri: string; name: string; mimeType: string };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(\?|$)/i;

export function isImageFile(f: { mimeType?: string | null; url?: string | null; name?: string | null }) {
  if ((f.mimeType || "").startsWith("image/")) return true;
  return IMAGE_EXT.test(f.url || "") || IMAGE_EXT.test(f.name || "");
}

export function isPdfFile(f: { mimeType?: string | null; url?: string | null; name?: string | null }) {
  return (f.mimeType || "").includes("pdf") || /\.pdf(\?|$)/i.test(f.url || "") || /\.pdf$/i.test(f.name || "");
}

export function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeName(name: string) {
  const cleaned = name.replace(/[^\w.\- ]+/g, "_").trim() || "file";
  return cleaned.length > 80 ? cleaned.slice(-80) : cleaned;
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function downloadToCache(url: string, name: string, headers?: Record<string, string>) {
  const dir = `${FileSystem.cacheDirectory}shared/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const target = `${dir}${Date.now()}-${safeName(name)}`;
  const res = await FileSystem.downloadAsync(url, target, headers ? { headers } : undefined);
  if (res.status >= 400) throw new Error(`Download failed (${res.status}).`);
  return res.uri;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const orgId = useAuthStore.getState().user?.orgId;
  if (orgId) headers["X-Organization-Id"] = orgId;
  return headers;
}

/** Open the system share sheet with the file itself (not just a link). */
export async function shareRemoteFile(url: string, name: string, mimeType?: string | null) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
  const uri = await downloadToCache(url, name);
  await Sharing.shareAsync(uri, { mimeType: mimeType || undefined, dialogTitle: name });
}

/** Share a file served by the Athena API (requires the signed-in user's token). */
export async function shareApiFile(path: string, name: string, mimeType = "application/pdf") {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
  const uri = await downloadToCache(`${getApiBaseUrl()}${path}`, name, await authHeaders());
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: name, UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : undefined });
}

/**
 * Save a copy on the device. Android asks for a folder (Downloads works);
 * iOS opens the share sheet where "Save to Files" lives.
 */
export async function saveRemoteFile(url: string, name: string, mimeType?: string | null): Promise<"saved" | "shared" | "cancelled"> {
  const uri = await downloadToCache(url, name);
  if (Platform.OS === "android") {
    const saf = FileSystem.StorageAccessFramework;
    const perm = await saf.requestDirectoryPermissionsAsync();
    if (!perm.granted) return "cancelled";
    const base = safeName(name).replace(/\.[^.]+$/, "");
    const dest = await saf.createFileAsync(perm.directoryUri, base, mimeType || "application/octet-stream");
    const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(dest, data, { encoding: FileSystem.EncodingType.Base64 });
    return "saved";
  }
  await Sharing.shareAsync(uri, { mimeType: mimeType || undefined, dialogTitle: name });
  return "shared";
}

function permissionDenied(what: string) {
  Alert.alert(
    `${what} access needed`,
    `Allow ${what.toLowerCase()} access for Athena in Settings to continue.`,
    [
      { text: "Not now", style: "cancel" },
      { text: "Open settings", onPress: () => void Linking.openSettings() },
    ],
  );
}

/** Launch the camera; returns null if cancelled or permission was refused. */
export async function takePhoto(): Promise<PickedFile | null> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain !== false) {
    granted = (await ImagePicker.requestCameraPermissionsAsync()).granted;
  }
  if (!granted) {
    permissionDenied("Camera");
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, exif: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName || `site-photo-${stamp()}.jpg`, mimeType: a.mimeType || "image/jpeg" };
}

export async function pickFromGallery(): Promise<PickedFile[]> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain !== false) {
    granted = (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
  }
  if (!granted) {
    permissionDenied("Photo library");
    return [];
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });
  if (res.canceled) return [];
  return (res.assets || []).map((a, i) => ({
    uri: a.uri,
    name: a.fileName || `site-photo-${stamp()}-${i + 1}.jpg`,
    mimeType: a.mimeType || "image/jpeg",
  }));
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  return (res.assets || []).map((a) => ({
    uri: a.uri,
    name: a.name || `document-${stamp()}`,
    mimeType: a.mimeType || "application/octet-stream",
  }));
}
