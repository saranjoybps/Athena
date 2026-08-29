import Link from "next/link";

export function EmptyState({ title, action }: { title: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
      <p>{title}</p>
      {action ? (
        <Link href={action.href} className="mt-3 inline-block text-clay font-medium">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
      {message}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-stone-600 mt-1">{subtitle}</p> : null}
    </div>
  );
}
