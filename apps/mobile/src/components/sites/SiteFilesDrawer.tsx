import { useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { Camera, Download, ExternalLink, FileText, ImagePlus, Paperclip, Share2, Trash2 } from "lucide-react-native";
import { useCreateSiteFile, useDeleteSiteFile, useSiteFiles } from "@/hooks/useApi";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { uploadUriToCloudinary } from "@/lib/cloudinary";
import {
  formatBytes,
  isImageFile,
  isPdfFile,
  pickDocuments,
  pickFromGallery,
  saveRemoteFile,
  shareRemoteFile,
  takePhoto,
  type PickedFile,
} from "@/lib/files";
import { formatDate } from "@/lib/format";
import { lightPalette as p, radius } from "@/lib/theme";

type Props = { siteId: string; siteName?: string; visible: boolean; onClose: () => void };

type FileRow = Record<string, unknown>;

/** Bottom drawer listing a site's files with camera / gallery / PDF upload and download / share. */
export function SiteFilesDrawer({ siteId, siteName, visible, onClose }: Props) {
  const filesQ = useSiteFiles(visible ? siteId : undefined);
  const createFile = useCreateSiteFile();
  const deleteFile = useDeleteSiteFile();
  const [uploading, setUploading] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const files = (filesQ.data?.items || []) as FileRow[];

  async function upload(picked: PickedFile[]) {
    if (!picked.length) return;
    let done = 0;
    try {
      for (const f of picked) {
        setUploading(picked.length > 1 ? `Uploading ${done + 1} of ${picked.length}…` : "Uploading…");
        const uploaded = await uploadUriToCloudinary(f.uri, { name: f.name, mimeType: f.mimeType, folder: `athena/sites/${siteId}` });
        await createFile.mutateAsync({
          siteId,
          body: {
            name: f.name,
            url: uploaded.url,
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType,
            mimeType: f.mimeType || uploaded.mimeType || null,
            bytes: uploaded.bytes ?? null,
            category: isPdfFile(f) ? "pdf" : isImageFile(f) ? "image" : "file",
          },
        });
        done += 1;
      }
      Toast.show({
        type: "success",
        text1: done > 1 ? `${done} files uploaded` : "File uploaded",
        text2: siteName ? `Saved to ${siteName}` : "Saved to this site",
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Couldn't upload file",
        text2:
          (done ? `${done} of ${picked.length} uploaded. ` : "") +
          ((e as { userMessage?: string })?.userMessage || (e as Error)?.message || "Please try again."),
      });
    } finally {
      setUploading(null);
    }
  }

  async function run(source: "camera" | "gallery" | "document") {
    try {
      const picked =
        source === "camera" ? [await takePhoto()].filter(Boolean) as PickedFile[] : source === "gallery" ? await pickFromGallery() : await pickDocuments();
      await upload(picked);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't open picker", text2: (e as Error)?.message || "Please try again." });
    }
  }

  async function onDownload(f: FileRow) {
    const id = String(f.id);
    setBusyId(id);
    try {
      const result = await saveRemoteFile(String(f.url || ""), String(f.name || "file"), f.mimeType as string | null);
      if (result === "saved") Toast.show({ type: "success", text1: "File downloaded", text2: "Saved to the folder you picked" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't download file", text2: (e as Error)?.message || "Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  async function onShare(f: FileRow) {
    const id = String(f.id);
    setBusyId(id);
    try {
      await shareRemoteFile(String(f.url || ""), String(f.name || "file"), f.mimeType as string | null);
    } catch (e) {
      Toast.show({ type: "error", text1: "Couldn't share file", text2: (e as Error)?.message || "Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  function onDelete(f: FileRow) {
    Alert.alert(f.name ? `Delete file "${String(f.name)}"?` : "Delete file?", "This file will be permanently removed from the site.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete file",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFile.mutateAsync({ siteId, fileId: String(f.id) });
            Toast.show({ type: "success", text1: "File deleted" });
          } catch (e) {
            Toast.show({ type: "error", text1: "Couldn't delete file", text2: (e as { userMessage?: string })?.userMessage || "Please try again." });
          }
        },
      },
    ]);
  }

  const disabled = Boolean(uploading);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Site files"
      subtitle={files.length ? `${files.length} file${files.length === 1 ? "" : "s"}${siteName ? ` · ${siteName}` : ""}` : siteName}
      fill
      footer={
        <View style={styles.uploadRow}>
          <UploadButton icon={<Camera size={18} color="#fff" />} label="Take photo" primary onPress={() => run("camera")} disabled={disabled} />
          <UploadButton icon={<ImagePlus size={18} color={p.clay} />} label="Gallery" onPress={() => run("gallery")} disabled={disabled} />
          <UploadButton icon={<Paperclip size={18} color={p.clay} />} label="PDF / file" onPress={() => run("document")} disabled={disabled} />
        </View>
      }
    >
      {uploading ? (
        <View style={styles.uploading}>
          <ActivityIndicator color={p.clay} />
          <Text style={styles.uploadingText}>{uploading}</Text>
        </View>
      ) : null}
      {filesQ.isLoading ? <ActivityIndicator color={p.clay} style={{ marginVertical: 24 }} /> : null}
      {filesQ.isError ? (
        <Pressable onPress={() => filesQ.refetch()} style={styles.empty}>
          <Text style={styles.emptyTitle}>Couldn't load files</Text>
          <Text style={styles.emptyText}>Tap to retry.</Text>
        </Pressable>
      ) : null}
      {!filesQ.isLoading && !filesQ.isError && files.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Camera size={26} color={p.clay} />
          </View>
          <Text style={styles.emptyTitle}>No files yet</Text>
          <Text style={styles.emptyText}>Take site photos or attach drawings and PDFs for reference.</Text>
        </View>
      ) : null}
      {files.map((f) => {
        const url = String(f.url || "");
        const image = isImageFile({ mimeType: f.mimeType as string, url, name: f.name as string }) || f.category === "image";
        const id = String(f.id);
        const meta = [formatBytes(f.bytes as number), f.createdAt ? formatDate(String(f.createdAt)) : ""].filter(Boolean).join(" · ");
        return (
          <View key={id} style={styles.file}>
            <Pressable onPress={() => Linking.openURL(url).catch(() => undefined)} style={styles.thumbWrap}>
              {image ? (
                <Image source={{ uri: url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.docThumb]}>
                  <FileText size={24} color={p.clay} />
                  <Text style={styles.docLabel}>{isPdfFile({ url, name: f.name as string, mimeType: f.mimeType as string }) ? "PDF" : "FILE"}</Text>
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.fileName} numberOfLines={2}>
                {String(f.name || "File")}
              </Text>
              {meta ? <Text style={styles.fileMeta}>{meta}</Text> : null}
              <View style={styles.actions}>
                {busyId === id ? (
                  <ActivityIndicator size="small" color={p.clay} />
                ) : (
                  <>
                    <IconAction label="Open" onPress={() => Linking.openURL(url).catch(() => undefined)} icon={<ExternalLink size={16} color={p.text} />} />
                    <IconAction label="Download" onPress={() => onDownload(f)} icon={<Download size={16} color={p.text} />} />
                    <IconAction label="Share" onPress={() => onShare(f)} icon={<Share2 size={16} color={p.text} />} />
                    <IconAction label="Delete" danger onPress={() => onDelete(f)} icon={<Trash2 size={16} color={p.red} />} />
                  </>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </BottomSheet>
  );
}

function UploadButton({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.uploadBtn, primary && styles.uploadPrimary, disabled && { opacity: 0.5 }]}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.uploadText, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

function IconAction({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.iconAction, danger && styles.iconDanger]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  uploadRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  uploadBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.clayMid,
    backgroundColor: p.claySoft,
  },
  uploadPrimary: { backgroundColor: p.clay, borderColor: p.clay },
  uploadText: { color: p.clayDark, fontWeight: "700", fontSize: 12 },
  uploading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: p.claySoft,
    marginBottom: 12,
  },
  uploadingText: { color: p.clayDark, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 36, gap: 6 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: p.claySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { color: p.text, fontWeight: "800", fontSize: 16 },
  emptyText: { color: p.muted, textAlign: "center", paddingHorizontal: 24 },
  file: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: p.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: p.border,
    padding: 10,
    marginBottom: 10,
  },
  thumbWrap: { borderRadius: 12, overflow: "hidden" },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: p.claySoft },
  docThumb: { alignItems: "center", justifyContent: "center", gap: 2 },
  docLabel: { color: p.clay, fontWeight: "800", fontSize: 11 },
  fileName: { color: p.text, fontWeight: "700" },
  fileMeta: { color: p.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: p.background,
    borderWidth: 1,
    borderColor: p.border,
  },
  iconDanger: { backgroundColor: p.redSoft, borderColor: "#FECACA" },
});
