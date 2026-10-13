import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import Toast from "react-native-toast-message";
import { useMeasurement, useUpdateMeasurement } from "@/hooks/useApi";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MeasurementEditor } from "@/components/ui/MeasurementEditor";
import {
  aggregateOutputs,
  buildMeasurementPayload,
  MeasurementItem,
  parseMeasurementItems,
} from "@/lib/measurements";
import { uploadUriToCloudinary } from "@/lib/cloudinary";
import { entityBackPath } from "@/lib/nav";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type PhotoRow = { name: string; url: string; publicId?: string };

export default function MeasurementDetail() {
  const { id, customerId, fromSite } = useLocalSearchParams<{
    id: string;
    customerId?: string;
    fromSite?: string;
  }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useMeasurement(id);
  const update = useUpdateMeasurement();
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [notes, setNotes] = useState("");
  const [billBySqft, setBillBySqft] = useState(false);
  const [perSqftRate, setPerSqftRate] = useState("");
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const siteId = fromSite || (data?.siteId ? String(data.siteId) : "");
  const custId = customerId || (data?.customerId ? String(data.customerId) : "");
  const backHref = entityBackPath({
    customerId: custId,
    tab: "measurements",
    siteId: null,
    siteTab: "measurements",
  });

  useEffect(() => {
    if (!data || hydrated) return;
    setItems(parseMeasurementItems(data as Record<string, unknown>));
    setNotes(String(data.notes || ""));
    setBillBySqft(Boolean(data.billBySqft));
    setPerSqftRate(data.perSqftRate != null ? String(data.perSqftRate) : "");
    const raw = Array.isArray(data.photos) ? data.photos : [];
    setPhotos(
      raw
        .map((row) => {
          const p = row as Record<string, unknown>;
          return {
            name: String(p.name || "photo"),
            url: String(p.url || ""),
            publicId: p.publicId ? String(p.publicId) : undefined,
          };
        })
        .filter((p) => p.url),
    );
    setHydrated(true);
  }, [data, hydrated]);

  const total = useMemo(() => aggregateOutputs(items).totalArea, [items]);

  async function addPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const folder = siteId ? `athena/measurements/${siteId}` : "athena/measurements";
      const uploaded: PhotoRow[] = [];
      for (const asset of result.assets) {
        const name = asset.fileName || `measurement-${Date.now()}.jpg`;
        const res = await uploadUriToCloudinary(asset.uri, {
          name,
          mimeType: asset.mimeType || "image/jpeg",
          folder,
        });
        uploaded.push({ name, url: res.url, publicId: res.publicId });
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      Toast.show({ type: "error", text1: "Upload failed", text2: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!items.length) {
      Toast.show({ type: "error", text1: "Add at least one line" });
      return;
    }
    if (billBySqft && !perSqftRate.trim()) {
      Toast.show({ type: "error", text1: "Enter per sqft rate for contract billing" });
      return;
    }
    setBusy(true);
    try {
      const payload = buildMeasurementPayload(items, notes || null, {
        billBySqft,
        perSqftRate: perSqftRate || null,
        photos,
      });
      await update.mutateAsync({
        id: String(id),
        body: {
          customerId: data?.customerId,
          siteId: data?.siteId,
          surveyId: data?.surveyId || null,
          ...payload,
        },
      });
      Toast.show({ type: "success", text1: "Measurement saved" });
      setHydrated(false);
      refetch();
    } catch (e) {
      Toast.show({ type: "error", text1: "Save failed", text2: (e as { userMessage?: string })?.userMessage });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Measurement"
          subtitle={total ? `≈ ${total} sqft` : String(data?.formulaKind || "")}
          onBack={() => router.replace(backHref as never)}
        />
        {isLoading ? <ActivityIndicator color={p.clay} /> : null}
        {isError ? (
          <ErrorBanner message={(error as { userMessage?: string })?.userMessage || "Failed"} onRetry={() => refetch()} />
        ) : null}
        {data && hydrated ? (
          <>
            <MeasurementEditor items={items} onChange={setItems} />

            <Pressable style={styles.checkRow} onPress={() => setBillBySqft((v) => !v)}>
              <View style={[styles.checkbox, billBySqft && styles.checkboxOn]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>Bill by sqft (contract)</Text>
                <Text style={styles.checkHint}>Invoices use total area × per sqft rate instead of schedule labour.</Text>
              </View>
            </Pressable>
            {billBySqft ? (
              <>
                <Text style={styles.label}>Per sqft rate *</Text>
                <TextInput
                  style={styles.input}
                  value={perSqftRate}
                  onChangeText={setPerSqftRate}
                  keyboardType="decimal-pad"
                  placeholderTextColor={p.faint}
                />
              </>
            ) : null}

            <View style={styles.photoHeader}>
              <Text style={styles.label}>Photos</Text>
              <Pressable style={styles.photoBtn} onPress={addPhotos} disabled={uploading}>
                <Text style={styles.photoBtnText}>{uploading ? "Uploading…" : "Add photos"}</Text>
              </Pressable>
            </View>
            {photos.length ? (
              <View style={styles.photoGrid}>
                {photos.map((ph) => (
                  <Image key={ph.url} source={{ uri: ph.url }} style={styles.thumb} />
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={p.faint}
            />
            <Pressable style={[styles.btn, (busy || uploading) && { opacity: 0.6 }]} onPress={save} disabled={busy || uploading}>
              <Text style={styles.btnText}>{busy ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { padding: spacing.lg, paddingBottom: tabBarClearance, gap: spacing.sm },
  label: { color: p.muted, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: p.text,
  },
  checkRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: p.border, marginTop: 2 },
  checkboxOn: { backgroundColor: p.clay, borderColor: p.clay },
  checkTitle: { color: p.text, fontWeight: "700" },
  checkHint: { color: p.muted, fontSize: 12, marginTop: 2 },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  photoBtn: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  photoBtnText: { color: p.text, fontWeight: "600", fontSize: 13 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: p.border },
  btn: { marginTop: spacing.lg, backgroundColor: p.clay, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
});
