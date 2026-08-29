export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b px-4 py-3 font-semibold text-clay">Fabrica · Customer</header>
      <div className="mx-auto max-w-3xl p-4 md:p-8">{children}</div>
    </div>
  );
}
