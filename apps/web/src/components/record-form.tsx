"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/states";

export type FormField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "relation" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** For relation fields: async loader of options (receives current form for cascading). */
  loadOptions?: (form: Record<string, string>) => Promise<{ value: string; label: string }[]>;
  /** Re-load relation options when these form keys change. */
  dependsOn?: string[];
  defaultValue?: string;
  readOnly?: boolean;
  hidden?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  fields: FormField[];
  submitLabel?: string;
  onSubmit: (form: Record<string, string>) => Promise<{ id?: string } | void>;
  successHref?: string | ((result: { id?: string }) => string);
  /** Optional panel above the form (e.g. read-only customer info). */
  infoPanel?: ReactNode;
};

export function RecordFormPage({
  title,
  subtitle,
  backHref,
  backLabel,
  fields,
  submitLabel = "Save",
  onSubmit,
  successHref,
  infoPanel,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = f.defaultValue || "";
    return init;
  });
  const [relationOptions, setRelationOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loaders = fields.filter((f) => f.type === "relation" && f.loadOptions && !f.dependsOn?.length);
    loaders.forEach((f) => {
      f.loadOptions!(form)
        .then((opts) => {
          if (!cancelled) setRelationOptions((prev) => ({ ...prev, [f.key]: opts }));
        })
        .catch(() => {
          if (!cancelled) setRelationOptions((prev) => ({ ...prev, [f.key]: [] }));
        });
    });
    return () => {
      cancelled = true;
    };
    // Mount-only for non-dependent relations; defaults are baked into form init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const dependents = fields.filter((f) => f.type === "relation" && f.loadOptions && f.dependsOn?.length);
    dependents.forEach((f) => {
      f.loadOptions!(form)
        .then((opts) => {
          if (cancelled) return;
          setRelationOptions((prev) => ({ ...prev, [f.key]: opts }));
          setForm((prev) => {
            const current = prev[f.key];
            if (current && !opts.some((o) => o.value === current)) {
              return { ...prev, [f.key]: "" };
            }
            return prev;
          });
        })
        .catch(() => {
          if (!cancelled) setRelationOptions((prev) => ({ ...prev, [f.key]: [] }));
        });
    });
    return () => {
      cancelled = true;
    };
    // Re-run when dependency values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => (f.dependsOn || []).map((k) => form[k]).join("|")).join("||")]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      for (const f of fields) {
        if (f.hidden || f.readOnly) continue;
        if (f.required && !String(form[f.key] || "").trim()) {
          throw new Error(`${f.label} is required`);
        }
      }
      const result = (await onSubmit(form)) || {};
      if (typeof successHref === "function") router.push(successHref(result));
      else if (successHref) router.push(successHref);
      else router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href={backHref} className="text-sm text-clay">
        ← {backLabel}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      {subtitle ? <p className="mt-1 text-stone-600">{subtitle}</p> : null}
      {infoPanel ? <div className="mt-4 max-w-xl">{infoPanel}</div> : null}

      <form onSubmit={save} className="mt-6 grid max-w-xl gap-3 rounded-2xl bg-white p-5 shadow-sm">
        {fields
          .filter((f) => !f.hidden)
          .map((field) => (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium text-stone-700">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.readOnly ? (
                <input
                  className="rounded-xl border bg-stone-50 px-3 py-2 text-stone-700"
                  value={
                    field.type === "relation" || field.type === "select"
                      ? (field.options || relationOptions[field.key] || []).find((o) => o.value === form[field.key])?.label ||
                        form[field.key] ||
                        ""
                      : form[field.key] || ""
                  }
                  readOnly
                />
              ) : field.type === "select" || field.type === "relation" ? (
                <select
                  className="rounded-xl border px-3 py-2"
                  value={form[field.key] || ""}
                  required={field.required}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {(field.options || relationOptions[field.key] || []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300"
                    checked={form[field.key] === "yes" || form[field.key] === "true"}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [field.key]: e.target.checked ? "yes" : "no" }))
                    }
                  />
                  <span>{field.placeholder || "Yes"}</span>
                </label>
              ) : field.type === "textarea" ? (
                <textarea
                  className="rounded-xl border px-3 py-2"
                  rows={3}
                  placeholder={field.placeholder}
                  value={form[field.key] || ""}
                  required={field.required}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              ) : (
                <input
                  className="rounded-xl border px-3 py-2"
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={form[field.key] || ""}
                  required={field.required}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        {error ? <ErrorState message={error} /> : null}
        <button type="submit" disabled={busy} className="rounded-xl bg-clay px-4 py-2 text-sm text-white disabled:opacity-60">
          {busy ? "Saving…" : submitLabel}
        </button>
      </form>
    </div>
  );
}

/** Build body from form, omitting empty optional strings as null */
export function formBody(form: Record<string, string>, keys: string[], nullEmpty = true) {
  const body: Record<string, unknown> = {};
  for (const k of keys) {
    const v = form[k];
    if (v === undefined || v === "") {
      if (nullEmpty) body[k] = null;
    } else {
      body[k] = v;
    }
  }
  return body;
}
