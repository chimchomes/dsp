import { useCallback, useEffect, useMemo, useState } from "react";

/** Default page size for all app list/table views (max rows per page). */
export const LIST_PAGE_SIZE = 10;

/**
 * Client-side pagination for an in-memory array. Resets to page 1 when `resetKey` changes.
 * Use for tables and card lists so every screen shows at most LIST_PAGE_SIZE rows with prev/next.
 */
export function useListPagination<T>(items: readonly T[], resetKey?: string) {
  const [page, setPage] = useState(1);
  const pageSize = LIST_PAGE_SIZE;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  const goPrev = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const goNext = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  return {
    page,
    setPage,
    pageSize,
    totalPages,
    totalItems,
    pageItems,
    goPrev,
    goNext,
  };
}
