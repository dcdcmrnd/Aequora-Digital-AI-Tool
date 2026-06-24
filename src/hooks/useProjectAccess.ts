"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { AccessLevel } from "@/types";

export function useProjectAccess(projectId: string | null): {
  accessLevel: AccessLevel | null;
  isLoading: boolean;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
} {
  const { data: session } = useSession();
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    if (!projectId || !session?.user) {
      setIsLoading(false);
      return;
    }

    if (isAdmin) {
      setAccessLevel("manager");
      setIsLoading(false);
      return;
    }

    fetch(`/api/projects/${projectId}/access/me`)
      .then((r) => r.json())
      .then((data) => {
        setAccessLevel(data.accessLevel ?? null);
      })
      .catch(() => setAccessLevel(null))
      .finally(() => setIsLoading(false));
  }, [projectId, session?.user?.id, isAdmin]);

  const levels = ["viewer", "contributor", "manager"];
  const idx = accessLevel ? levels.indexOf(accessLevel) : -1;

  return {
    accessLevel,
    isLoading,
    canView: isAdmin || idx >= 0,
    canEdit: isAdmin || idx >= 1,
    canManage: isAdmin || idx >= 2,
  };
}
