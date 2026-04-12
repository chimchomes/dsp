/**
 * Central pagination for list/table UIs: 10 rows per page + Previous/Next.
 * Import from here in new screens so behavior stays consistent.
 */
export { LIST_PAGE_SIZE, useListPagination } from "@/hooks/useListPagination";
export { ListPaginationBar } from "@/components/ListPaginationBar";
export type { ListPaginationBarProps } from "@/components/ListPaginationBar";
