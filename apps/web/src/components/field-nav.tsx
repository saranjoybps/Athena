import Link from "next/link";

const tabs = [
  { href: "/field", label: "Home" },
  { href: "/field/projects", label: "Projects" },
  { href: "/field/tasks", label: "Tasks" },
  { href: "/field/camera", label: "Camera" },
  { href: "/field/attendance", label: "Attendance" },
  { href: "/field/materials", label: "Materials" },
  { href: "/field/expenses", label: "Expenses" },
  { href: "/field/more", label: "More" },
];

export function FieldNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 flex overflow-x-auto border-t border-stone-200 bg-white text-xs">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="flex-1 min-w-[4.5rem] py-3 text-center">
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
