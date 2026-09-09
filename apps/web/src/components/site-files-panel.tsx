"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState } from "@/components/states";
import { athena } from "@/lib/athena-client";
import { uploadToCloudinary } from "@/lib/cloudinary";

type SiteFile = {
  id: string;
  name?: string;
  url?: string;
  category?: string;
  mimeType?: string;
  resourceType?: string;
  createdAt?: string;
};

export function SiteFilesPanel({ siteId }: { siteId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await athena.sites.files.list(siteId);
    setFiles((res.items || []) as SiteFile[]);
  }, [siteId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load files"));
  }, [load]);

  async function onPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadToCloudinary(file, `athena/sites/${siteId}`);
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        await athena.sites.files.create(siteId, {
          name: file.name,
          url: uploaded.url,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
          mimeType: uploaded.mimeType || file.type || null,
          bytes: uploaded.bytes ?? null,
          category: isPdf ? "pdf" : "image",
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(fileId: string) {
    setBusy(true);
    setError(null);
    try {
      await athena.sites.files.remove(siteId, fileId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Site proof files</h2>
          <p className="mt-1 text-sm text-stone-600">Upload site photos or PDFs as reference proof.</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload image / PDF"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      {files.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-stone-500">
          No files yet. Upload a site photo or PDF for reference.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((f) => {
            const url = String(f.url || "");
            const isImage = String(f.category || "") === "image" || /\.(png|jpe?g|webp|gif)$/i.test(url);
            return (
              <div key={f.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={String(f.name || "Site file")} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-sand text-sm text-stone-600">PDF</div>
                )}
                <div className="space-y-2 p-3">
                  <p className="truncate text-sm font-medium text-stone-800">{String(f.name || "File")}</p>
                  <div className="flex gap-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-3 py-1.5 text-xs text-clay"
                    >
                      Open
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(f.id)}
                      className="rounded-lg border px-3 py-1.5 text-xs text-red-700 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
