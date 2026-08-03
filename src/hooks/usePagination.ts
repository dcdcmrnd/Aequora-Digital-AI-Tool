"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Client-side pagination over an already-loaded list. Pass whatever the
 * caller's search/filter state is as `resetKey` so changing it jumps back
 * to page 1 — otherwise a filter change can strand you on a page number
 * that no longer has anything relevant on it.
 */
export function usePagination<T>(items: T[], pageSize: number = DEFAULT_PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, resetKey]);

  const paginated = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return { page, setPage, pageCount, paginated, total: items.length };
}
