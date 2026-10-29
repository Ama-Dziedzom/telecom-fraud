"use client";

import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Foundations · Table (1318:165568 / 1316:164172 / 1316:164029) — white,
 * 1px border-default, radius 8. Header row surface-raised 40 high, Caption
 * sentence case; rows 56, divider under, hover sunken, selected brand subtle.
 * `footer` is the Pagination row (always the last row).
 */
export function DataTable({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full rounded-lg border border-border-default bg-surface-base", className)}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-left [&_tbody_tr:last-child_td]:border-b-0">{children}</table>
      {footer && <div className="border-t border-border-default">{footer}</div>}
    </div>
  );
}

/** Header cell. `sorted` = Caption Medium text-primary with the sort arrow; `sortable` shows the up/down hint. */
export function Th({
  align = "left",
  sorted,
  sortable,
  onSort,
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right";
  sorted?: boolean;
  sortable?: boolean;
  onSort?: () => void;
}) {
  const label = (
    <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
      {children}
      {sorted && <Icon name="app/icon-sort-desc-primary-14" size={14} />}
      {!sorted && sortable && <Icon name="app/icon-sort-tertiary-14" size={14} />}
    </span>
  );
  return (
    <th
      scope="col"
      aria-sort={sorted ? "descending" : undefined}
      className={cn(
        "h-10 border-b border-border-default bg-surface-raised px-4 text-caption first:rounded-tl-lg last:rounded-tr-lg",
        sorted ? "font-medium text-text-primary" : "font-normal text-text-secondary",
        align === "right" && "text-right",
        className,
      )}
      {...props}
    >
      {onSort ? (
        <button type="button" onClick={onSort} className="rounded">
          {label}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/** Body cell — Body/S text-primary, 56 high. Numbers right-aligned. */
export function Td({
  align = "left",
  clip = true,
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right";
  clip?: boolean;
}) {
  return (
    <td
      className={cn("h-14 border-b border-border-default px-4 text-body-s text-text-primary", clip && "truncate", align === "right" && "text-right tabular-nums", className)}
      {...props}
    >
      {children}
    </td>
  );
}

/** Selection cell (header or row). */
export function CheckCell({
  head,
  label,
  checked,
  indeterminate,
  onChange,
}: {
  head?: boolean;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (on: boolean) => void;
}) {
  const box = <Checkbox label={label} hideLabel checked={checked} indeterminate={indeterminate} onChange={(e) => onChange(e.target.checked)} />;
  return head ? (
    <th scope="col" className="h-10 w-12 border-b border-border-default bg-surface-raised pl-4 first:rounded-tl-lg">
      {box}
    </th>
  ) : (
    <td className="h-14 w-12 border-b border-border-default pl-4" onClick={(e) => e.stopPropagation()}>
      {box}
    </td>
  );
}

/** Row classes — hover sunken, selected brand subtle; the last row drops its divider when there’s no footer. */
export const rowClass = (selected?: boolean, clickable = true) => cn(clickable && "cursor-pointer", selected ? "bg-brand-primary-subtle-hover" : "hover:bg-surface-sunken");

/** Skeleton rows (G7) — one bar per column, widths from the design. */
export function SkeletonRows({ widths, rows = 5, check = true }: { widths: Array<number | [number, number] | "pill" | "person">; rows?: number; check?: boolean }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} aria-hidden>
          {check && (
            <td className="h-[52px] border-b border-border-default pl-4">
              <Skeleton className="size-4 rounded" />
            </td>
          )}
          {widths.map((w, j) => (
            <td key={j} className="h-[52px] border-b border-border-default px-4">
              {w === "pill" ? (
                <Skeleton className="h-5 w-[52px] rounded-full" />
              ) : w === "person" ? (
                <span className="flex items-center gap-2">
                  <Skeleton className="size-5 rounded-full" />
                  <Skeleton className="h-2.5 w-[72px]" />
                </span>
              ) : Array.isArray(w) ? (
                <span className="flex flex-col gap-1.5">
                  <span style={{ width: w[0] - (i % 2) * 32 }}>
                    <Skeleton className="h-2.5 w-full" />
                  </span>
                  <span style={{ width: w[1] }}>
                    <Skeleton className="h-2 w-full" />
                  </span>
                </span>
              ) : (
                <span className="block" style={{ width: w }}>
                  <Skeleton className="h-2.5 w-full" />
                </span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Empty / error state inside the table body (Foundations 1319:167943 / 1319:167944). */
export function TableState({ colSpan, icon, title, children, action }: { colSpan: number; icon: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10">
        <EmptyState bare icon={icon} title={title} actions={action}>
          {children}
        </EmptyState>
      </td>
    </tr>
  );
}

/** Foundations · Pagination (1333:187856) — the last row: summary left, 32px page buttons right. */
export function Pagination({ summary, page = 1, pages = 1, onPage }: { summary: ReactNode; page?: number; pages?: number; onPage?: (p: number) => void }) {
  const items: Array<number | "…"> = pages <= 5 ? Array.from({ length: pages }, (_, i) => i + 1) : page <= 3 ? [1, 2, 3, "…", pages] : [1, "…", page, "…", pages];
  return (
    <div className="flex h-14 items-center justify-between gap-4 rounded-b-lg pr-3 pl-4">
      <p className="text-body-s text-text-secondary">{summary}</p>
      {pages > 1 && onPage && (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Icon name="app/icon-chevron-left-16" size={16} />
          </button>
          {items.map((p, i) =>
            p === "…" ? (
              <span key={i} className="flex size-8 items-center justify-center text-body-s text-text-tertiary">
                …
              </span>
            ) : (
              <button
                key={i}
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-body-s",
                  p === page ? "bg-brand-primary-subtle text-text-brand" : "text-text-secondary hover:bg-surface-sunken",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={page === pages}
            onClick={() => onPage(page + 1)}
            className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Icon name="app/icon-chevron-right-primary-16" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

/** Foundations · Toolbar search (1318:165959) — 32 high, border-strong, 16 search icon. */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-8 w-[280px] shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus",
        className,
      )}
    >
      <Icon name="app/icon-search-tertiary-16" size={16} />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-body-s text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
      />
    </label>
  );
}

/** Filter-bar button (Filters ▾, View: … ▾). `active` = brand tint with the count. */
export function FilterButton({
  icon,
  children,
  count,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: "filter";
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border pr-2 pl-3 text-label-s",
        active ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand" : "border-border-strong bg-surface-base text-text-primary hover:bg-surface-raised",
      )}
      {...props}
    >
      {icon && <Icon name={active ? "app/icon-filter-brand-16" : "app/icon-filter-secondary-16"} size={16} />}
      <span className="max-w-[260px] truncate">{children}</span>
      {count !== undefined && <span className="px-1 text-body-s">{count}</span>}
      <Icon name={active ? "app/icon-chevron-down-brand-16" : "app/icon-chevron-down-16"} size={16} />
    </button>
  );
}

/** Foundations · Segment chip (1318:166033) — 32 high, label + count; the current one is brand subtle. */
export function SegmentChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string; count?: number }>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-body-s",
              on ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand" : "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
            )}
          >
            <span className="font-medium">{o.label}</span>
            {o.count !== undefined && <span className={on ? "text-text-brand" : "text-text-tertiary"}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filter-bar dropdown — 32 high; brand tint once it narrows the map (Foundations · Filter bar 1318:166034). */
export function ToolbarSelect({
  label,
  value,
  onChange,
  options,
  active,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  active?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative flex h-8 shrink-0 items-center rounded-lg border pr-7 pl-3 focus-within:shadow-focus",
        active ? "border-brand-primary-subtle-hover bg-brand-primary-subtle" : "border-border-strong bg-surface-base hover:bg-surface-raised",
      )}
    >
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "field-sizing-content cursor-pointer appearance-none bg-transparent text-label-s outline-none focus-visible:shadow-none",
          active ? "text-text-brand" : "text-text-primary",
        )}
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
      <Icon name={active ? "app/icon-chevron-down-brand-16" : "app/icon-chevron-down-16"} size={16} className="pointer-events-none absolute right-2" />
    </label>
  );
}

/** Filter-bar divider. */
export const BarDivider = () => <span aria-hidden className="h-5 w-px shrink-0 bg-border-strong" />;

/** Foundations · Bulk action bar (1335:188151) — brand-subtle bar over the table while rows are selected. */
export function BulkBar({
  count,
  noun,
  detail,
  onClear,
  children,
}: {
  count: number;
  /** “3 cases selected”; without a noun, “6 selected”. */
  noun?: [string, string];
  detail?: ReactNode;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div role="toolbar" aria-label="Bulk actions" className="flex h-12 items-center gap-3 rounded-lg border border-brand-primary bg-brand-primary-subtle pr-2 pl-4">
      <Checkbox label="Clear selection" hideLabel checked indeterminate onChange={onClear} />
      <p className="flex min-w-0 flex-1 items-baseline gap-2 truncate">
        <span className="text-label-s text-text-primary">
          {count} {noun ? `${count === 1 ? noun[0] : noun[1]} ` : ""}selected
        </span>
        {detail && <span className="truncate text-caption text-text-secondary">{detail}</span>}
      </p>
      {children}
      <button type="button" aria-label="Clear selection" onClick={onClear} className="flex size-8 items-center justify-center rounded-lg hover:bg-brand-primary-subtle-hover">
        <Icon name="app/icon-x-primary-18" size={16} />
      </button>
    </div>
  );
}

/** Secondary sm button for the bulk bar. */
export function BulkAction(props: ComponentProps<typeof Button>) {
  return <Button variant="secondary" size="sm" {...props} />;
}

export type RowMenuItem = {
  title: string;
  icon?: string;
  onSelect: () => void;
  tone?: "critical";
  disabled?: boolean;
};

/**
 * Foundations · Row actions menu (1318:165788) — ghost 32 “…” button; 200 wide,
 * 32-high Body/S items, a critical item always last after a divider.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const destructive = items.filter((it) => it.tone === "critical");
  const row = (it: RowMenuItem, close: () => void) => (
    <MenuItem
      key={it.title}
      icon={it.icon}
      title={it.title}
      tone={it.tone}
      disabled={it.disabled}
      onSelect={() => {
        close();
        it.onSelect();
      }}
    />
  );
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <Menu
        label={label}
        width={200}
        compact
        trigger={(t) => (
          <button
            type="button"
            aria-label={label}
            onClick={t.toggle}
            aria-expanded={t["aria-expanded"]}
            aria-haspopup="menu"
            className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-sunken"
          >
            <Icon name="app/icon-more-16" size={16} />
          </button>
        )}
      >
        {(close) => (
          <>
            {items.filter((it) => it.tone !== "critical").map((it) => row(it, close))}
            {destructive.length > 0 && <MenuDivider />}
            {destructive.map((it) => row(it, close))}
          </>
        )}
      </Menu>
    </span>
  );
}
