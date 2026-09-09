"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";

type Field = {
  key: string;
  label: string;
  multiline?: boolean;
  type?: string;
  options?: { value: string; label: string }[];
};

type Props = {
  title: string;
  backHref: string;
  backLabel: string;
  /** When set, navigate here after a successful save. */
  successHref?: string;
  /** Hide back link when embedded inside another page (e.g. customer/site tabs). */
  hideBack?: boolean;
  load: () => Promise<Record<string, unknown>>;
  save: (form: Record<string, string>) => Promise<unknown>;
  fields: Field[];
  mapToForm: (doc: Record<string, unknown>) => Record<string, string>;
  subtitle?: (doc: Record<string, unknown>) => string;
};

export function EditableDetailPage({
  title,
  backHref,
  backLabel,
  successHref,
  hideBack,
  load,
  save,
  fields,
  mapToForm,
  subtitle,
}: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load()
      .then((d) => {
        setDoc(d);
        setForm(mapToForm(d));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load, mapToForm]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await save(form);
      if (successHref) {
        router.push(successHref);
        return;
      }
      setSaved(true);
      const refreshed = await load();
      setDoc(refreshed);
      setForm(mapToForm(refreshed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !doc) return <ErrorState message={error} />;
  if (!doc) return <p className="text-stone-600">Loading…</p>;

  return (
    <div>
      {!hideBack ? (
        <Link href={backHref} className="text-sm text-clay">
          ← {backLabel}
        </Link>
      ) : null}
      <h1 className={`${hideBack ? "" : "mt-2 "}text-2xl font-semibold`}>{title}</h1>
      {subtitle ? <p className="mt-1 text-stone-600">{subtitle(doc)}</p> : null}

      <form onSubmit={onSave} className="mt-6 grid max-w-xl gap-3 rounded-2xl bg-white p-5 shadow-sm">
        {fields.map((field) =>
          field.type === "checkbox" ? (
            <label key={field.key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300"
                checked={form[field.key] === "yes" || form[field.key] === "true"}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [field.key]: e.target.checked ? "yes" : "no" }))
                }
              />
              <span className="font-medium text-stone-700">{field.label}</span>
            </label>
          ) : (
          <label key={field.key} className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">{field.label}</span>
            {field.options ? (
              <select
                className="rounded-xl border px-3 py-2"
                value={form[field.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              >
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.multiline ? (
              <textarea
                className="rounded-xl border px-3 py-2"
                rows={3}
                value={form[field.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            ) : (
              <input
                className="rounded-xl border px-3 py-2"
                type={field.type || "text"}
                value={form[field.key] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            )}
          </label>
          ),
        )}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved ? <span className="text-sm text-emerald-700">Saved</span> : null}
        </div>
      </form>
    </div>
  );
}
