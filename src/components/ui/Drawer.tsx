"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Drawer — details without losing the list. 480–640 wide, inset 16, full
 * height: header (badges, title, sub, ×) + scroll body + footer actions.
 * Slides in from the right; <dialog> gives focus trapping and Esc.
 */
export function Drawer({
  open,
  onClose,
  width = 540,
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
  /** Tab row under the title, inside the header. */
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
        "fixed top-4 right-4 bottom-4 left-auto m-0 h-auto max-h-none max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl bg-surface-base p-0 shadow-lg backdrop:bg-overlay open:flex",
        "open:animate-[drawer-in_240ms_ease-out] motion-reduce:open:animate-none",
      )}
    >
      <header className="flex flex-col gap-3.5 border-b border-border-subtle px-6 pt-[22px] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            {badges && (
              <div className="flex flex-wrap items-center gap-2">{badges}</div>
            )}
            {/* Focus starts on the title, so screen readers announce it and no button looks pressed. */}
            <h2 id="drawer-title" tabIndex={-1} autoFocus className="text-h2 text-text-primary outline-none focus-visible:shadow-none">
              {title}
            </h2>
            {subtitle && (
              <p className="text-body-s text-text-secondary">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-10 items-center justify-center rounded-[10px] border border-border-default bg-surface-base hover:bg-surface-raised"
            >
              <Icon name="app/icon-x" size={20} />
            </button>
          </div>
        </div>
        {tabs}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
        {children}
      </div>
      {footer && (
        <footer className="flex items-center gap-2.5 border-t border-border-subtle bg-surface-raised px-6 py-3.5">
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
          className="flex items-center justify-between gap-4 border-b border-border-subtle py-[9px] last:border-b-0"
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
