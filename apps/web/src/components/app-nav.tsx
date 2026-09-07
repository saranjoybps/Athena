"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Pipeline",
    items: [
      { href: "/app", label: "Home" },
      { href: "/app/customers", label: "Customers" },
      { href: "/app/sites", label: "Sites" },
      { href: "/app/estimates", label: "Estimates" },
      { href: "/app/quotes", label: "Quotes" },
      { href: "/app/projects", label: "Projects" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/app/accounting", label: "Accounts" },
      { href: "/app/invoices", label: "Invoices" },
      { href: "/app/payments", label: "Payments" },
      { href: "/app/expenses", label: "Expenses" },
    ],
  },
  {
    title: "Field",
    items: [
      { href: "/app/attendance", label: "Attendance" },
      { href: "/app/snags", label: "Snags" },
      { href: "/app/change-orders", label: "Change orders" },
      { href: "/app/schedule", label: "Schedule" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/app/materials", label: "Materials" },
      { href: "/app/suppliers", label: "Suppliers" },
      { href: "/app/labour", label: "Labour" },
      { href: "/app/crews", label: "Crews" },
      { href: "/app/inventory", label: "Inventory" },
      { href: "/app/procurement", label: "Procurement" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/app/vehicles", label: "Vehicles" },
      { href: "/app/photos", label: "Photos" },
      { href: "/app/documents", label: "Documents" },
      { href: "/app/users", label: "Users" },
      { href: "/app/reports", label: "Reports" },
      { href: "/app/settings", label: "Settings" },
    ],
  },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-stone-200 bg-white p-4">
      <Link href="/app" className="mb-5 text-lg font-semibold text-clay">
        Athena
      </Link>
      <nav className="flex flex-col gap-4 text-sm max-h-[calc(100dvh-5rem)] overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{group.title}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((i) => {
                const active = i.href === "/app" ? pathname === "/app" : pathname === i.href || pathname.startsWith(`${i.href}/`);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={`rounded-lg px-3 py-2 ${active ? "bg-sand font-medium text-clay" : "hover:bg-sand"}`}
                  >
                    {i.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <p className="mt-4 px-3 text-[11px] leading-snug text-stone-400">Surveys & measurements live inside each site.</p>
    </aside>
  );
}
