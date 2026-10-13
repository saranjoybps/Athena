import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";
import {
  useCreateSiteFile,
  useDeleteSiteFile,
  useSite,
  useSiteFiles,
  useUpdateSite,
} from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { uploadUriToCloudinary } from "@/lib/cloudinary";
import { customerPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

/** Site details + proof file uploads (image / PDF). */
export default function SiteDetail() {
  const { id, customerId: customerParam } = useLocalSearchParams<{
    id: string;
    customerId?: string;
  }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useSite(id);
  const filesQ = useSiteFiles(id ? String(id) : undefined);
  const createFile = useCreateSiteFile();
  const deleteFile = useDeleteSiteFile();
  const update = useUpdateSite();
  const customerId = customerParam || (data?.customerId ? String(data.customerId) : "");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [siteType, setSiteType] = useState("");
  const [access, setAccess] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(String(data.name || ""));
    setLocation(String(data.address || ""));
    setSiteType(String(data.siteType || ""));
    setAccess(String(data.accessInstructions || ""));
    setLat(data.lat != null ? String(data.lat) : "");
    setLng(data.lng != null ? String(data.lng) : "");
  }, [data]);

  async function saveDetails() {
    setBusy(true);
    try {
      const latN = lat.trim() ? Number(lat) : null;
      const lngN = lng.trim() ? Number(lng) : null;
      await update.mutateAsync({
        id: String(id),
        body: {
          customerId: data?.customerId || customerId,
          name,
          address: location,
          siteType: siteType || null,
          accessInstructions: access || null,
          lat: Number.isFinite(latN as number) ? latN : null,
          lng: Number.isFinite(lngN as number) ? lngN : null,
          mapsUrl:
            Number.isFinite(latN as number) && Number.isFinite(lngN as number) && latN != null && lngN != null
              ? `https://maps.google.com/?q=${latN},${lngN}`
              : null,
        },
      });
      Toast.show({ type: "success", text1: "Site saved" });
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  async function persistUpload(uri: string, fileName: string, mimeType?: string | null) {
    setUploading(true);
    try {
      const uploaded = await uploadUriToCloudinary(uri, {
        name: fileName,
        mimeType: mimeType || undefined,
        folder: `athena/sites/${id}`,
      });
      const isPdf = (mimeType || "").includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
      await createFile.mutateAsync({
        siteId: String(id),
        body: {
          name: fileName,
          url: uploaded.url,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          mimeType: mimeType || uploaded.mimeType || null,
          bytes: uploaded.bytes ?? null,
          category: isPdf ? "pdf" : "image",
        },
      });
      Toast.show({ type: "success", text1: "Uploaded" });
      filesQ.refetch();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Upload failed",
        text2: (e as { userMessage?: string; message?: string })?.userMessage || (e as Error).message,
      });
    } finally {
      setUploading(false);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const fileName = asset.fileName || `site-${Date.now()}.jpg`;
    await persistUpload(asset.uri, fileName, asset.mimeType || "image/jpeg");
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await persistUpload(asset.uri, asset.name || `site-file-${Date.now()}`, asset.mimeType);
  }

  async function removeFile(fileId: string) {
    try {
      await deleteFile.mutateAsync({ siteId: String(id), fileId });
      Toast.show({ type: "success", text1: "Removed" });
      filesQ.refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Remove failed", text2: (e as { userMessage?: string })?.userMessage });
    }
  }

  const backHref = customerId ? customerPath(customerId, "sites") : "/(tabs)/customers";
  const files = filesQ.data?.items || [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={String(data?.name || "Site")}
          subtitle="Site details"
          onBack={() => router.replace(backHref as never)}
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {data ? (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Site location</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={location}
              onChangeText={setLocation}
              multiline
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Site type</Text>
            <TextInput style={styles.input} value={siteType} onChangeText={setSiteType} placeholderTextColor={p.faint} />
            <Text style={styles.label}>Access</Text>
            <TextInput
              style={[styles.input, styles.multi]}
              value={access}
              onChangeText={setAccess}
              multiline
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Latitude (GPS)</Text>
            <TextInput
              style={styles.input}
              value={lat}
              onChangeText={setLat}
              keyboardType="decimal-pad"
              placeholderTextColor={p.faint}
            />
            <Text style={styles.label}>Longitude (GPS)</Text>
            <TextInput
              style={styles.input}
              value={lng}
              onChangeText={setLng}
              keyboardType="decimal-pad"
              placeholderTextColor={p.faint}
            />
            <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={saveDetails} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save details"}</Text>
            </Pressable>
            {(() => {
              const maps =
                String(data.mapsUrl || "") ||
                (lat.trim() && lng.trim() ? `https://www.google.com/maps/search/?api=1&query=${lat.trim()},${lng.trim()}` : "") ||
                (location.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}` : "");
              if (!maps) return null;
              return (
                <Pressable
                  style={styles.btnGhost}
                  onPress={() => Linking.openURL(maps).catch(() => Toast.show({ type: "error", text1: "Could not open maps" }))}
                >
                  <Text style={styles.btnGhostText}>Open in Maps</Text>
                </Pressable>
              );
            })()}
          </View>
        ) : null}

        {customerId ? (
          <>
            <Text style={styles.section}>Site workflow</Text>
            <View style={styles.rowActions}>
              <Pressable
                style={styles.btnGhost}
                onPress={() =>
                  router.push(`/(tabs)/surveys/new?customerId=${customerId}&siteId=${id}` as never)
                }
              >
                <Text style={styles.btnGhostText}>Survey</Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() =>
                  router.push(`/(tabs)/measurements/new?customerId=${customerId}&siteId=${id}` as never)
                }
              >
                <Text style={styles.btnGhostText}>Measure</Text>
              </Pressable>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                style={styles.btnGhost}
                onPress={() =>
                  router.push(`/(tabs)/estimates/new?customerId=${customerId}&siteId=${id}` as never)
                }
              >
                <Text style={styles.btnGhostText}>Estimate</Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() => router.replace(customerPath(customerId, "sites") as never)}
              >
                <Text style={styles.btnGhostText}>Customer</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Site proof files</Text>
        <Text style={styles.hint}>Upload site photos or PDFs as reference proof.</Text>
        <View style={styles.rowActions}>
          <Pressable style={[styles.btnGhost, uploading && { opacity: 0.6 }]} onPress={pickImage} disabled={uploading}>
            <Text style={styles.btnGhostText}>{uploading ? "Uploading…" : "Upload photo"}</Text>
          </Pressable>
          <Pressable style={[styles.btnGhost, uploading && { opacity: 0.6 }]} onPress={pickPdf} disabled={uploading}>
            <Text style={styles.btnGhostText}>Upload PDF / file</Text>
          </Pressable>
        </View>

        {filesQ.isLoading ? <ActivityIndicator color={p.clay} style={{ marginTop: 12 }} /> : null}
        {files.length === 0 && !filesQ.isLoading ? (
          <Text style={styles.empty}>No files yet.</Text>
        ) : null}
        {files.map((f) => {
          const url = String(f.url || "");
          const isImage = String(f.category || "") === "image" || /\.(png|jpe?g|webp|gif)$/i.test(url);
          return (
            <View key={String(f.id)} style={styles.fileCard}>
              {isImage ? <Image source={{ uri: url }} style={styles.thumb} /> : <View style={styles.pdfThumb}><Text style={styles.pdfLabel}>PDF</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {String(f.name || "File")}
                </Text>
                <View style={styles.fileActions}>
                  <Pressable onPress={() => Linking.openURL(url).catch(() => undefined)}>
                    <Text style={styles.link}>Open</Text>
                  </Pressable>
                  <Pressable onPress={() => removeFile(String(f.id))}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance },
  card: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: p.border,
    gap: 8,
  },
  label: { color: p.muted, fontWeight: "600", marginTop: 4 },
  input: {
    backgroundColor: p.background,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: p.text,
  },
  multi: { minHeight: 72, textAlignVertical: "top" },
  btn: { marginTop: 12, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  section: { color: p.text, fontWeight: "700", fontSize: 16, marginTop: spacing.lg, marginBottom: 4 },
  hint: { color: p.muted, fontSize: 13, marginBottom: 10 },
  rowActions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: p.border,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnGhostText: { color: p.clay, fontWeight: "700", fontSize: 13 },
  empty: { color: p.muted, marginTop: 8 },
  fileCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: p.claySoft },
  pdfThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pdfLabel: { color: p.clay, fontWeight: "800" },
  fileName: { color: p.text, fontWeight: "600" },
  fileActions: { flexDirection: "row", gap: 16, marginTop: 8 },
  link: { color: p.clay, fontWeight: "700" },
  remove: { color: p.red, fontWeight: "700" },
});
