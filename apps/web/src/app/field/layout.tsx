import { FieldNav } from "@/components/field-nav";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sand pb-20">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3 font-semibold text-clay">Fabrica Field</header>
      <div className="p-4">{children}</div>
      <FieldNav />
    </div>
  );
}
