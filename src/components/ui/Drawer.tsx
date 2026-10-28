"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Drawer — right side, 560 wide, viewport height minus 32 (16 from the top,
 * right and bottom). Header: pills + ghost close, H3 title, meta; optional
 * tabs at the bottom of the header. Body 24 padding, 20 gap. Footer on a
 * divider: Dismiss left, one Primary right. 50% scrim; <dialog> gives focus
 * trapping and Esc.
 */
export function Drawer({
  open,
  onClose,
  width = 560,
  badges,
  title,
  subtitle,
  headerActions,
  tabs,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  badges?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  /** Tab row at the bottom of the header. */
  tabs?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="drawer-title"
      style={{ width }}
      className={cn(
        "fixed top-4 right-4 bottom-4 left-auto m-0 h-auto max-h-none max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-border-default bg-surface-base p-0 shadow-[0_24px_48px_-12px_rgb(15_23_42/0.2)] backdrop:bg-overlay open:flex",
        "open:animate-[drawer-in_240ms_ease-out] motion-reduce:open:animate-none",
      )}
    >
      <header className={cn("flex shrink-0 flex-col gap-3 border-b border-border-default pt-5 pr-4 pl-6", !tabs && "pb-5")}>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{badges}</div>
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-sunken"
          >
            <Icon name="app/icon-x-secondary-16" size={16} />
          </button>
        </div>
        <div className="flex min-w-0 flex-col gap-1 pr-2">
          {/* Focus starts on the title, so screen readers announce it and no button looks pressed. */}
          <h2 id="drawer-title" tabIndex={-1} autoFocus className="text-h3 text-text-primary outline-none focus-visible:shadow-none">
            {title}
          </h2>
          {subtitle && <p className="text-body-s text-text-secondary">{subtitle}</p>}
        </div>
        {tabs && <div className="pt-2 pr-2">{tabs}</div>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
        {children}
      </div>
      {footer && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-border-default px-6 py-4">
          {footer}
        </footer>
      )}
    </dialog>
  );
}

/** Key–value list — Body/S key left, Body/M Medium value right, dividers. */
export function KeyValueList({
  rows,
}: {
  rows: Array<[ReactNode, ReactNode]>;
}) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v], i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 border-b border-border-default py-[9px] last:border-b-0"
        >
          <dt className="text-body-s text-text-secondary">{k}</dt>
          <dd className="text-right text-body-m font-medium text-text-primary">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
