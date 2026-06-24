"use client";

import { useSession } from "next-auth/react";
import type { PermissionType } from "@/types";

export function usePermission(permission: PermissionType): boolean {
  const { data: session } = useSession();
  if (!session?.user) return false;
  if (session.user.role === "admin") return true;
  return session.user.permissions?.includes(permission) ?? false;
}

export function useIsAdmin(): boolean {
  const { data: session } = useSession();
  return session?.user?.role === "admin";
}

export function useCurrentUser() {
  const { data: session } = useSession();
  return session?.user ?? null;
}
