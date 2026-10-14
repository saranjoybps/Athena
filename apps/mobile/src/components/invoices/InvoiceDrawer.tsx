import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { InvoiceActions, InvoiceBody, useInvoiceState, type InvoiceNav } from "@/components/invoices/InvoiceView";
import { projectPath } from "@/lib/nav";

function DrawerContent({ id, visible, nav, onClose }: { id: string; visible: boolean; nav: InvoiceNav; onClose: () => void }) {
  const { invoice, number, customer, kindLabel } = useInvoiceState(id, true);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={invoice ? number : "Invoice"}
      subtitle={invoice ? [customer?.company || customer?.name, kindLabel].filter(Boolean).join(" · ") : undefined}
      fill
      maxHeight={0.92}
      footer={<InvoiceActions id={id} nav={nav} />}
    >
      <InvoiceBody id={id} nav={nav} />
    </BottomSheet>
  );
}

let queued: { id: string; at: number } | null = null;

/** Opens the invoice in the drawer of the screen the user returns to (e.g. after creating it). */
export function openInvoiceDrawerOnReturn(id: string) {
  queued = { id, at: Date.now() };
}

/**
 * Invoice bottom drawer. Leaving it for a form (edit, record payment, payment detail) closes it,
 * and it re-opens when the screen regains focus so the user lands back on the refreshed invoice.
 * Pass `onProject` when the host screen is the project itself, so "View project" just closes the drawer.
 */
export function useInvoiceDrawer(opts?: { onProject?: (projectId: string) => void }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const reopen = useRef<string | null>(null);
  const onProject = opts?.onProject;

  useEffect(() => {
    if (openId) setShownId(openId);
  }, [openId]);

  useFocusEffect(
    useCallback(() => {
      if (queued) {
        const fresh = Date.now() - queued.at < 5000;
        const id = queued.id;
        queued = null;
        if (fresh) {
          reopen.current = null;
          setOpenId(id);
          return;
        }
      }
      if (reopen.current) {
        const id = reopen.current;
        reopen.current = null;
        setOpenId(id);
      }
    }, []),
  );

  const go = useCallback(
    (href: string, reopenAfter: boolean) => {
      reopen.current = reopenAfter ? openId : null;
      setOpenId(null);
      setTimeout(() => router.push(href as never), 180);
    },
    [openId, router],
  );

  const nav = useMemo<InvoiceNav>(
    () => ({
      edit: (id, projectId) => go(`/(tabs)/invoices/${id}/edit${projectId ? `?projectId=${projectId}` : ""}`, true),
      recordPayment: (id, projectId) => go(`/(tabs)/payments/new?invoiceId=${id}${projectId ? `&projectId=${projectId}` : ""}`, true),
      payment: (paymentId) => go(`/(tabs)/payments/${paymentId}`, true),
      project: (projectId) => {
        if (onProject) {
          setOpenId(null);
          onProject(projectId);
          return;
        }
        go(projectPath(projectId, "money"), false);
      },
    }),
    [go, onProject],
  );

  const element = shownId ? <DrawerContent id={shownId} visible={Boolean(openId)} nav={nav} onClose={() => setOpenId(null)} /> : null;

  return { open: (id: string) => setOpenId(id), close: () => setOpenId(null), element };
}
