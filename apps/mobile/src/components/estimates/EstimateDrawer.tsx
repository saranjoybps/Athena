import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EstimateActions, EstimateBody, useEstimateState } from "@/components/estimates/EstimateView";

type Contact = { phone?: string | null; email?: string | null };

function DrawerContent({ id, visible, contact, onClose, onNavigate }: {
  id: string;
  visible: boolean;
  contact?: Contact;
  onClose: () => void;
  onNavigate: (href: string, reopen: boolean) => void;
}) {
  const { estimate } = useEstimateState(id, true);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={String(estimate?.title || estimate?.number || "Estimate")}
      subtitle={estimate?.number ? String(estimate.number) : undefined}
      fill
      maxHeight={0.92}
      footer={
        <EstimateActions
          id={id}
          contact={contact}
          nav={{
            edit: (estimateId) => onNavigate(`/(tabs)/estimates/${estimateId}/edit`, true),
            project: (projectId) => onNavigate(`/(tabs)/projects/${projectId}`, false),
            deleted: onClose,
          }}
        />
      }
    >
      <EstimateBody id={id} />
    </BottomSheet>
  );
}

/**
 * Estimate bottom drawer. Editing closes it, and it re-opens when the screen regains focus,
 * so the user lands back on the refreshed PDF preview of the new version.
 */
export function useEstimateDrawer(contact?: Contact) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const reopen = useRef<string | null>(null);

  useEffect(() => {
    if (openId) setShownId(openId);
  }, [openId]);

  useFocusEffect(
    useCallback(() => {
      if (reopen.current) {
        const id = reopen.current;
        reopen.current = null;
        setOpenId(id);
      }
    }, []),
  );

  const onNavigate = useCallback(
    (href: string, reopenAfter: boolean) => {
      reopen.current = reopenAfter ? openId : null;
      setOpenId(null);
      setTimeout(() => router.push(href as never), 180);
    },
    [openId, router],
  );

  const element = shownId ? (
    <DrawerContent id={shownId} visible={Boolean(openId)} contact={contact} onClose={() => setOpenId(null)} onNavigate={onNavigate} />
  ) : null;

  return { open: (id: string) => setOpenId(id), close: () => setOpenId(null), element };
}
