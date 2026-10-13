import type { SessionUser } from "@/types";

/** Mirrors RequestContext.require on the API: "*" grants everything. */
export function hasPermission(user: SessionUser | null | undefined, permission: string): boolean {
  const permissions = user?.permissions ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
