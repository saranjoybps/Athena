import Link from "next/link";

const items = [
  { href: "/app", label: "Home" },
  { href: "/app/customers", label: "Customers" },
  { href: "/app/sites", label: "Sites" },
  { href: "/app/surveys", label: "Surveys" },
  { href: "/app/measurements", label: "Measurements" },
  { href: "/app/estimates", label: "Estimates" },
  { href: "/app/quotes", label: "Quotes" },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/materials", label: "Materials" },
  { href: "/app/suppliers", label: "Suppliers" },
  { href: "/app/procurement", label: "Procurement" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/labour", label: "Labour" },
  { href: "/app/attendance", label: "Attendance" },
  { href: "/app/expenses", label: "Expenses" },
  { href: "/app/invoices", label: "Invoices" },
  { href: "/app/payments", label: "Payments" },
  { href: "/app/change-orders", label: "Change orders" },
  { href: "/app/snags", label: "Snags" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/settings", label: "Settings" },
];

export function AppNav() {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4">
      <Link href="/app" className="mb-6 text-lg font-semibold text-clay">
        Fabrica
      </Link>
      <nav className="flex flex-col gap-1 text-sm max-h-[calc(100dvh-5rem)] overflow-y-auto">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="rounded-lg px-3 py-2 hover:bg-sand">
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
