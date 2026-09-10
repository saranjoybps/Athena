"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/states";
import { athena, optionsFrom } from "@/lib/athena-client";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { formatCurrency } from "@/lib/format";
import { useNameMaps } from "@/lib/name-maps";

type DocRow = {
  id: string;
  kind: "document" | "invoice";
  name: string;
  subtitle: string;
  href: string;
  siteId?: string;
};

export default function Page() {
  const { projects } = useNameMaps();
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [projectSiteById, setProjectSiteById] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<Array<{ value: string; label: string }>>([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [uploadSiteId, setUploadSiteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const [d, inv, siteOpts, projectRes] = await Promise.all([
      athena.documents.list(),
      athena.invoices.list(),
      optionsFrom(athena.sites.list),
      athena.projects.list(),
    ]);
    setDocs(d.items || []);
    setInvoices(inv.items || []);
    setSites(siteOpts);
    const map: Record<string, string> = {};
    for (const p of projectRes.items || []) {
      if (p.id && p.siteId) map[String(p.id)] = String(p.siteId);
    }
    setProjectSiteById(map);
  }, []);

  useEffect(() => {
    reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [reload]);

  const rows = useMemo(() => {
    const out: DocRow[] = [];
    for (const inv of invoices) {
      const projectId = String(inv.projectId || "");
      const siteId = projectSiteById[projectId] || "";
      out.push({
        id: `inv-${String(inv.id)}`,
        kind: "invoice",
        name: String(inv.number || inv.id),
        subtitle: `${formatCurrency(String(inv.grandTotal || inv.amount || 0))} · ${String(inv.status || "draft")} · ${
          projects[projectId] || "Project"
        }`,
        href: `/app/invoices/${String(inv.id)}${projectId ? `?projectId=${projectId}` : ""}`,
        siteId,
      });
    }
    for (const doc of docs) {
      const siteId = String(doc.siteId || "");
      out.push({
        id: `doc-${String(doc.id)}`,
        kind: "document",
        name: String(doc.name || doc.id),
        subtitle: `${String(doc.category || "document")}${siteId ? ` · site` : ""}`,
        href: `/app/documents/${String(doc.id)}`,
        siteId,
      });
    }
    return out.filter((r) => !siteFilter || r.siteId === siteFilter);
  }, [docs, invoices, projects, projectSiteById, siteFilter]);

  async function onPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (!uploadSiteId) {
      setError("Select a site before uploading.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadToCloudinary(file, `athena/sites/${uploadSiteId}`);
        await athena.documents.create({
          name: file.name,
          url: uploaded.url,
          publicId: uploaded.publicId,
          category: file.type.startsWith("image/") ? "image" : "pdf",
          siteId: uploadSiteId,
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-stone-600">All invoices plus site uploads.</p>
        </div>
        <Link href="/app/documents/new" className="rounded-xl bg-clay px-4 py-2 text-sm text-white">
          Add document link
        </Link>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Filter by site</span>
          <select className="rounded-xl border px-3 py-2" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">All</option>
            {sites.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-stone-700">Upload file for a site</span>
          <div className="flex flex-wrap gap-2">
            <select
              className="min-w-[180px] flex-1 rounded-xl border px-3 py-2"
              value={uploadSiteId}
              onChange={(e) => setUploadSiteId(e.target.value)}
            >
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !uploadSiteId}
              className="rounded-xl bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => inputRef.current?.click()}
            >
              {busy ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
          </div>
        </label>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-2">
        {!rows.length ? <p className="text-sm text-stone-600">No documents or invoices yet.</p> : null}
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm hover:bg-sand"
          >
            <div>
              <p className="font-medium text-stone-900">{row.name}</p>
              <p className="mt-1 text-sm text-stone-600">{row.subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs uppercase tracking-wide text-stone-600">
              {row.kind}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
