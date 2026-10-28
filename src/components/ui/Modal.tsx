"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import type { IconTileTone } from "./IconTile";

/**
 * Modal — centred dialog on a 50% scrim. S 400, M 560, L 800; height hugs
 * content. Header: H3 title + optional Body/S meta + ghost close; body with
 * 24 padding; footer on a divider, right-aligned: Cancel (Secondary) then one
 * Primary or Danger. Radius 8, 1px border. Uses <dialog> for focus trapping
 * and Esc handling.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  width = 400,
}: {
  open: boolean;
  onClose: () => void;
  /** @deprecated Direction v2 modals carry no icon tile. */
  icon?: string;
  /** @deprecated See `icon`. */
  tone?: IconTileTone;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions: ReactNode;
  width?: number;
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
      aria-labelledby="modal-title"
      style={{ width }}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] rounded-lg border border-border-default bg-surface-base shadow-[0_24px_48px_-12px_rgb(15_23_42/0.2)] backdrop:bg-overlay",
        "open:flex open:flex-col open:animate-[modal-in_200ms_ease-out] motion-reduce:open:animate-none",
      )}
    >
      <div className="flex shrink-0 items-start gap-3 pt-5 pr-4 pb-4 pl-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="modal-title" tabIndex={-1} autoFocus className="text-h3 text-text-primary outline-none focus-visible:shadow-none">
            {title}
          </h2>
          {description && <p className="text-body-s text-text-secondary">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-surface-sunken"
        >
          <Icon name="app/icon-x-secondary-16" size={16} />
        </button>
      </div>
      {children && <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">{children}</div>}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-default px-6 py-4">{actions}</div>
    </dialog>
  );
}
