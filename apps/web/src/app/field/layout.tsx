"use client";

import { FieldNav } from "@/components/field-nav";
import { TrialBanner } from "@/components/trial-banner";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sand pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <span className="font-semibold text-clay">Athena Field</span>
        <TrialBanner variant="header" />
      </header>
      <div className="p-4">{children}</div>
      <FieldNav />
    </div>
  );
}
