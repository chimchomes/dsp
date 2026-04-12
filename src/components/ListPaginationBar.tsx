import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIST_PAGE_SIZE } from "@/hooks/useListPagination";

export interface ListPaginationBarProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

/**
 * Shared prev/next + "Showing X–Y of Z" + "Page N of M" for all paginated lists.
 */
export function ListPaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize = LIST_PAGE_SIZE,
  onPrev,
  onNext,
  className,
}: ListPaginationBarProps) {
  if (totalItems === 0) {
    return null;
  }

  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-sm text-muted-foreground">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 1}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page === totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}
