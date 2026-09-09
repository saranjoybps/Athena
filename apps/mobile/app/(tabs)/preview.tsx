import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

/** Opens a Cloudinary (or other) PDF URL for estimate/invoice preview. */
export default function PreviewScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const decoded = url ? decodeURIComponent(String(url)) : "";

  async function openPdf() {
    if (!decoded) {
      setError("No PDF URL available yet. Save the document so it uploads to Cloudinary.");
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const can = await Linking.canOpenURL(decoded);
      if (!can) throw new Error("Cannot open this URL on this device");
      await Linking.openURL(decoded);
    } catch (e) {
      setError((e as Error).message || "Failed to open PDF");
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    if (decoded) openPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <ScreenHeader
          title={title ? String(title) : "Preview"}
          subtitle="Cloudinary PDF"
          onBack={() => router.back()}
        />
        <View style={styles.card}>
          <Text style={styles.hint}>
            Preview loads the stored Cloudinary PDF for this estimate or invoice. If the file was just created, wait a moment and retry.
          </Text>
          {decoded ? <Text style={styles.url} numberOfLines={4}>{decoded}</Text> : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Pressable style={styles.btn} onPress={openPdf} disabled={opening || !decoded}>
            {opening ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Open PDF preview</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { flex: 1, padding: spacing.lg, paddingBottom: tabBarClearance },
  card: {
    marginTop: spacing.md,
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    gap: 12,
  },
  hint: { color: p.muted, fontSize: 14, lineHeight: 20 },
  url: { color: p.text, fontSize: 12 },
  err: { color: p.red },
  btn: {
    backgroundColor: p.clay,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
