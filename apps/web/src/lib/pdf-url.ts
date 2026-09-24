/** Normalize PDF URLs for open/share. Do not rewrite Cloudinary /raw/ → /image/
 *  (assets uploaded as raw 404 if the path type is changed). */
export function normalizePdfUrl(url: string | null | undefined): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  let cleaned = raw.startsWith("http://") ? `https://${raw.slice(7)}` : raw;
  if (!cleaned.toLowerCase().endsWith(".pdf") && cleaned.includes("/upload/") && !cleaned.includes("?")) {
    cleaned = `${cleaned}.pdf`;
  }
  return cleaned;
}
