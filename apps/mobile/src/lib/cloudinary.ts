import Constants from "expo-constants";

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
  mimeType?: string;
};

function cloudName() {
  return (
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    String((Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.cloudinaryCloudName || "")
  );
}

function uploadPreset() {
  return (
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    String((Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.cloudinaryUploadPreset || "Athena")
  );
}

export async function uploadUriToCloudinary(
  uri: string,
  opts: { name: string; mimeType?: string; folder?: string },
): Promise<CloudinaryUploadResult> {
  const cloud = cloudName();
  if (!cloud) throw new Error("Cloudinary cloud name is not configured.");

  const form = new FormData();
  form.append("file", {
    uri,
    name: opts.name,
    type: opts.mimeType || "application/octet-stream",
  } as unknown as Blob);
  form.append("upload_preset", uploadPreset());
  form.append("folder", opts.folder || "athena/sites");

  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Cloudinary upload failed");
  }
  const data = (await res.json()) as Record<string, unknown>;
  const url = String(data.secure_url || data.url || "");
  if (!url) throw new Error("Upload succeeded but no URL returned");
  return {
    url,
    publicId: String(data.public_id || ""),
    resourceType: String(data.resource_type || "auto"),
    format: data.format ? String(data.format) : undefined,
    bytes: typeof data.bytes === "number" ? data.bytes : undefined,
    mimeType: opts.mimeType,
  };
}
