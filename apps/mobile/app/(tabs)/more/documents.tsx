import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Toast from "react-native-toast-message";
import { ModuleListScreen } from "@/components/ui/ModuleListScreen";
import { RecordCard } from "@/components/ui/RecordCard";
import { useCreateDocument, useDocuments, useInvoices, useProjects, useSites } from "@/hooks/useApi";
import { uploadUriToCloudinary } from "@/lib/cloudinary";
import { formatCurrency } from "@/lib/format";
import { lightPalette as p, radius, spacing } from "@/lib/theme";
import { Linking } from "react-native";

type Row = {
  id: string;
  kind: "invoice" | "document";
  title: string;
  subtitle: string;
  href?: string;
  url?: string;
  siteId?: string;
};

export default function DocumentsScreen() {
  const router = useRouter();
  const docsQ = useDocuments();
  const invQ = useInvoices();
  const sitesQ = useSites();
  const projectsQ = useProjects();
  const createDoc = useCreateDocument();
  const [siteFilter, setSiteFilter] = useState("");
  const [uploadSiteId, setUploadSiteId] = useState("");
  const [uploading, setUploading] = useState(false);

  const sites = sitesQ.data?.items ?? [];
  const projects = projectsQ.data?.items ?? [];

  const projectSite = useMemo(() => {
    const map: Record<string, string> = {};
    for (const proj of projects) {
      if (proj.id && proj.siteId) map[String(proj.id)] = String(proj.siteId);
    }
    return map;
  }, [projects]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const inv of invQ.data?.items ?? []) {
      const projectId = String(inv.projectId || "");
      out.push({
        id: `inv-${String(inv.id)}`,
        kind: "invoice",
        title: String(inv.number || inv.id),
        subtitle: `${formatCurrency(String(inv.grandTotal || inv.total || inv.amount || 0))} · ${String(inv.status || "draft")}`,
        href: `/(tabs)/invoices/${String(inv.id)}${projectId ? `?projectId=${projectId}` : ""}`,
        siteId: projectSite[projectId] || "",
      });
    }
    for (const doc of docsQ.data?.items ?? []) {
      const siteId = String(doc.siteId || "");
      out.push({
        id: `doc-${String(doc.id)}`,
        kind: "document",
        title: String(doc.name || doc.id),
        subtitle: String(doc.category || doc.url || ""),
        url: String(doc.url || ""),
        siteId,
      });
    }
    return out.filter((r) => !siteFilter || r.siteId === siteFilter);
  }, [docsQ.data, invQ.data, siteFilter, projectSite]);

  async function uploadFile(kind: "image" | "pdf") {
    if (!uploadSiteId) {
      Toast.show({ type: "error", text1: "Select a site first" });
      return;
    }
    setUploading(true);
    try {
      if (kind === "image") {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const name = asset.fileName || `site-${Date.now()}.jpg`;
        const uploaded = await uploadUriToCloudinary(asset.uri, {
          name,
          mimeType: asset.mimeType || "image/jpeg",
          folder: `athena/sites/${uploadSiteId}`,
        });
        await createDoc.mutateAsync({
          name,
          url: uploaded.url,
          publicId: uploaded.publicId,
          category: "image",
          siteId: uploadSiteId,
        });
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const uploaded = await uploadUriToCloudinary(asset.uri, {
          name: asset.name || "document.pdf",
          mimeType: asset.mimeType || "application/pdf",
          folder: `athena/sites/${uploadSiteId}`,
        });
        await createDoc.mutateAsync({
          name: asset.name || "document.pdf",
          url: uploaded.url,
          publicId: uploaded.publicId,
          category: "pdf",
          siteId: uploadSiteId,
        });
      }
      Toast.show({ type: "success", text1: "Uploaded" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Upload failed", text2: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const loading = docsQ.isLoading || invQ.isLoading;
  const refreshing = docsQ.isRefetching || invQ.isRefetching;

  return (
    <ModuleListScreen
      title="Documents"
      subtitle="Invoices and site uploads"
      items={rows}
      loading={loading}
      refreshing={refreshing}
      errorMessage={
        docsQ.isError || invQ.isError
          ? ((docsQ.error || invQ.error) as { userMessage?: string })?.userMessage
          : undefined
      }
      onBack={() => router.back()}
      onRetry={() => {
        docsQ.refetch();
        invQ.refetch();
      }}
      onRefresh={() => {
        docsQ.refetch();
        invQ.refetch();
      }}
      emptyTitle="No documents or invoices"
      emptySubtitle="Upload site files below, or create invoices from a project."
      headerExtra={
        <View style={styles.panel}>
          <Text style={styles.label}>Filter by site</Text>
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, !siteFilter && styles.chipOn]}
              onPress={() => setSiteFilter("")}
            >
              <Text style={[styles.chipText, !siteFilter && styles.chipTextOn]}>All</Text>
            </Pressable>
            {sites.map((s) => (
              <Pressable
                key={String(s.id)}
                style={[styles.chip, siteFilter === String(s.id) && styles.chipOn]}
                onPress={() => setSiteFilter(String(s.id))}
              >
                <Text style={[styles.chipText, siteFilter === String(s.id) && styles.chipTextOn]}>
                  {String(s.name || s.id)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Upload for site</Text>
          <View style={styles.chips}>
            {sites.map((s) => (
              <Pressable
                key={`up-${String(s.id)}`}
                style={[styles.chip, uploadSiteId === String(s.id) && styles.chipOn]}
                onPress={() => setUploadSiteId(String(s.id))}
              >
                <Text style={[styles.chipText, uploadSiteId === String(s.id) && styles.chipTextOn]}>
                  {String(s.name || s.id)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.uploadRow}>
            <Pressable
              style={[styles.uploadBtn, (!uploadSiteId || uploading) && { opacity: 0.5 }]}
              disabled={!uploadSiteId || uploading}
              onPress={() => uploadFile("image")}
            >
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadText}>Photo</Text>}
            </Pressable>
            <Pressable
              style={[styles.uploadBtnMuted, (!uploadSiteId || uploading) && { opacity: 0.5 }]}
              disabled={!uploadSiteId || uploading}
              onPress={() => uploadFile("pdf")}
            >
              <Text style={styles.uploadTextMuted}>PDF</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={(item) => (
        <RecordCard
          title={item.title}
          subtitle={item.subtitle}
          status={item.kind}
          onPress={() => {
            if (item.kind === "invoice" && item.href) {
              router.push(item.href as never);
              return;
            }
            if (item.url?.startsWith("http")) Linking.openURL(item.url).catch(() => undefined);
          }}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: p.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: p.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  label: { color: p.muted, fontWeight: "600", fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: p.background,
  },
  chipOn: { backgroundColor: p.claySoft, borderColor: p.clay },
  chipText: { color: p.muted, fontSize: 13 },
  chipTextOn: { color: p.clay, fontWeight: "700" },
  uploadRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  uploadBtn: {
    flex: 1,
    backgroundColor: p.clay,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  uploadBtnMuted: {
    flex: 1,
    backgroundColor: p.background,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: p.border,
  },
  uploadText: { color: "#fff", fontWeight: "700" },
  uploadTextMuted: { color: p.text, fontWeight: "700" },
});
