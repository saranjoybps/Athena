"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/auth";
import { platform } from "@/lib/api";

export function usePendingUpgrades() {
  const { session } = useAdminAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!session?.token) return;
    platform.upgradeRequests(session.token).then((r) => setCount(r.items?.length || 0)).catch(() => setCount(0));
  }, [session?.token]);
  return count;
}
