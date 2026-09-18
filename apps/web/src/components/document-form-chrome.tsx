"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  accent?: "clay" | "amber" | "green";
  children: ReactNode;
  footer?: ReactNode;
};

const ACCENT = {
  clay: "border-l-clay",
  amber: "border-l-amber-600",
  green: "border-l-emerald-600",
};

/** Shared create-document layout: accent header, body, sticky actions. */
export function DocumentFormChrome({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  accent = "clay",
  children,
  footer,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      {backHref ? (
        <Link href={backHref} className="text-sm text-clay">
          ← {backLabel}
        </Link>
      ) : null}
      <div className={`mt-2 rounded-2xl border border-stone-200 border-l-4 bg-white shadow-sm ${ACCENT[accent]}`}>
        <div className="border-b border-stone-100 px-5 py-4">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-stone-600">{subtitle}</p> : null}
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-stone-100 bg-sand/80 px-5 py-3 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      {children}
    </section>
  );
}

export function DocTotals({
  rows,
}: {
  rows: Array<{ label: string; value: string; emphasis?: boolean }>;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-sand/50 p-4">
      {rows.map((r) => (
        <div key={r.label} className={`flex justify-between gap-4 py-1 text-sm ${r.emphasis ? "font-semibold text-ink" : "text-stone-600"}`}>
          <span>{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
