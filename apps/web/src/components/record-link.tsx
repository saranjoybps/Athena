"use client";

import Link from "next/link";

type Props = {
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
  status?: string;
};

export function RecordLink({ title, subtitle, href, meta, status }: Props) {
  return (
    <Link href={href} className="rounded-2xl bg-white p-4 shadow-sm block hover:ring-2 hover:ring-clay/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          {subtitle ? <p className="text-sm text-stone-600">{subtitle}</p> : null}
          {meta ? <p className="mt-1 text-xs text-stone-500">{meta}</p> : null}
        </div>
        {status ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs capitalize text-stone-600">{status}</span> : null}
      </div>
      <p className="mt-2 text-xs text-clay">Open →</p>
    </Link>
  );
}
