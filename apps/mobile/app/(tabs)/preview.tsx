import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import apiClient from "@/lib/api";
import { normalizePdfUrl } from "@/lib/pdf-url";
import { lightPalette as p, radius, spacing, tabBarClearance } from "@/lib/theme";

type PreviewPage = {
  page: number;
  width: number;
  height: number;
  mimeType: string;
  imageBase64: string;
};

type PreviewPagesResponse = {
  pageCount: number;
  pages: PreviewPage[];
};

/** In-app PDF preview via API-rasterized page images (no Cloudinary / WebView / PDF.js). */
export default function PreviewScreen() {
  const { url, title, id, kind } = useLocalSearchParams<{
    url?: string;
    title?: string;
    id?: string;
    kind?: string;
  }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const cloudUrl = normalizePdfUrl(url ? decodeURIComponent(String(url)) : "");
  const docId = id ? String(id) : "";
  const docKind = kind ? String(kind) : "";

  const apiPath = useMemo(() => {
    if (!docId || !docKind) return null;
    if (docKind === "invoice") return `/invoices/${docId}/preview-pages`;
    if (docKind === "estimate") return `/estimates/${docId}/preview-pages`;
    if (docKind === "quote" || docKind === "quotation") return `/quotes/${docId}/preview-pages`;
    return null;
  }, [docId, docKind]);

  const pageWidth = Dimensions.get("window").width - spacing.md * 2 - 2;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setPages([]);
      try {
        if (!apiPath) throw new Error("Open Preview from an invoice or estimate.");
        const res = await apiClient.get<PreviewPagesResponse>(apiPath);
        if (cancelled) return;
        const next = Array.isArray(res.data?.pages) ? res.data.pages : [];
        if (!next.length) throw new Error("No preview pages returned");
        setPages(next);
        setPageCount(Number(res.data?.pageCount || next.length));
      } catch (e) {
        if (!cancelled) {
          const err = e as { userMessage?: string; message?: string; response?: { status?: number } };
          setError(
            err.userMessage ||
              err.message ||
              (err.response?.status ? `Preview failed (HTTP ${err.response.status})` : "Could not load PDF preview"),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiPath]);

  async function openExternally() {
    if (!cloudUrl) {
      setError((prev) => prev || "No Cloudinary PDF link available.");
      return;
    }
    try {
      await Linking.openURL(cloudUrl);
    } catch {
      setError("Could not open PDF outside the app");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <ScreenHeader
          title={title ? String(title) : "Preview"}
          subtitle={pageCount ? `PDF · ${pageCount} page${pageCount === 1 ? "" : "s"}` : "PDF preview"}
          onBack={() => {
            if (docKind === "invoice" && docId) {
              router.replace(`/(tabs)/invoices/${docId}` as never);
              return;
            }
            if (docKind === "estimate" && docId) {
              router.replace(`/(tabs)/estimates/${docId}` as never);
              return;
            }
            if ((docKind === "quote" || docKind === "quotation") && docId) {
              router.replace(`/(tabs)/quotes/${docId}` as never);
              return;
            }
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/" as never);
          }}
        />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={p.clay} size="large" />
            <Text style={styles.loadingText}>Generating PDF preview…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.err}>{error}</Text>
            <Text style={styles.hint}>Make sure the API is running and pymupdf is installed.</Text>
            <Pressable style={styles.linkBtn} onPress={openExternally}>
              <Text style={styles.linkText}>Open PDF in browser</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && pages.length ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator
          >
            {pages.map((page) => {
              const aspect = page.height > 0 && page.width > 0 ? page.height / page.width : 1.414;
              return (
                <View key={page.page} style={styles.pageCard}>
                  <Text style={styles.pageLabel}>Page {page.page}</Text>
                  <Image
                    source={{ uri: `data:${page.mimeType || "image/png"};base64,${page.imageBase64}` }}
                    style={{ width: pageWidth, height: pageWidth * aspect }}
                    resizeMode="contain"
                  />
                </View>
              );
            })}
            <Pressable style={styles.linkBtn} onPress={openExternally} disabled={!cloudUrl}>
              <Text style={[styles.linkText, !cloudUrl && { opacity: 0.4 }]}>Open PDF in browser</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.background },
  content: { flex: 1, paddingHorizontal: spacing.md, paddingBottom: tabBarClearance },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: p.muted, fontSize: 14 },
  scroll: { paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: 12 },
  pageCard: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.sm,
    overflow: "hidden",
  },
  pageLabel: {
    color: p.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
    marginLeft: 4,
  },
  errorCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    gap: 8,
  },
  err: { color: p.red, fontSize: 14, lineHeight: 20 },
  hint: { color: p.muted, fontSize: 12 },
  linkBtn: { marginTop: spacing.sm, paddingVertical: 12, alignItems: "center" },
  linkText: { color: p.clay, fontWeight: "600", fontSize: 13 },
});
