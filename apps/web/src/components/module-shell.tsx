import { EmptyState, PageHeader } from "@/components/states";

export default function ModuleShell({
  title,
  subtitle,
  createHref,
  createLabel,
}: {
  title: string;
  subtitle: string;
  createHref?: string;
  createLabel?: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        title="No records yet. Job data is created from the operational chain, not a lead pipeline."
        action={createHref && createLabel ? { href: createHref, label: createLabel } : undefined}
      />
    </>
  );
}
