import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * Table wrapper — white, 1px border, radius 8. No overflow clipping, so row
 * menus can open past the last row; the header corners are rounded instead.
 * `footer` is the Pagination row (one page: just the count).
 */
export function DataTable({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full rounded-lg border border-border-default bg-surface-base", className)}>
      <table className="w-full table-fixed text-left">{children}</table>
      {footer && <p className="flex h-14 items-center border-t border-border-default pr-3 pl-4 text-body-s text-text-secondary">{footer}</p>}
    </div>
  );
}

/** Table header row — surface raised, 40 high, 1px divider. */
export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="[&_th:first-child]:rounded-tl-[7px] [&_th:last-child]:rounded-tr-[7px]">
      <tr>{children}</tr>
    </thead>
  );
}

/** Header cell — Caption, sentence case, text secondary. `align="right"` for numbers. */
export function Th({ align = "left", className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn("h-10 border-b border-border-default bg-surface-raised px-4 text-caption font-normal text-text-secondary", align === "right" && "text-right", className)}
      {...props}
    >
      {children}
    </th>
  );
}

/** Table row — 56 (64 with a two-line cell), divider under, hover sunken. */
export function Tr({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-border-default last:border-b-0", className)} {...props}>
      {children}
    </tr>
  );
}

/** Table cell — Body/S text primary; numbers right-aligned. `clip={false}` for cells holding a menu. */
export function Td({ align = "left", clip = true, className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right"; clip?: boolean }) {
  return (
    <td className={cn("h-14 px-4 text-body-s text-text-primary", clip && "truncate", align === "right" && "text-right", className)} {...props}>
      {children}
    </td>
  );
}

/** Two-line cell — Label/S title over a Caption line; makes its row 64. */
export function TwoLine({ title, sub }: { title: ReactNode; sub: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-label-s text-text-primary">{title}</span>
      <span className="truncate text-caption text-text-secondary">{sub}</span>
    </span>
  );
}
