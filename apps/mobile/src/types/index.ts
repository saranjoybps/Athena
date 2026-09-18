export type Paginated<T> = { items: T[] };

export type AthenaRecord = Record<string, unknown> & {
  id: string;
  number?: string;
  name?: string;
  title?: string;
  status?: string;
  createdAt?: string;
};

import type { Entitlements } from "@/lib/entitlements";

export type SessionUser = {
  userId: string;
  email?: string;
  orgId: string | null;
  roles: string[];
  permissions: string[];
  businessName?: string;
  entitlements?: Entitlements | null;
};
