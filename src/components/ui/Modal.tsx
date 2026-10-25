"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, type ReactNode } from "react";
import { IconTile, type IconTileTone } from "./IconTile";

/**
 * Modal — icon tile + title + sub + body + right-aligned actions.
 * 480–760 wide · radius 16 · Shadow/LG · overlay #14112F @ 45%.
 * Uses <dialog> for focus trapping and Esc handling.
 */
export function Modal({
  open,
  onClose,
  icon,
  tone,
  title,
  description,
  children,
  actions,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  icon?: string;
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
        "m-auto max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-base p-7 shadow-lg backdrop:bg-overlay",
        "open:animate-[modal-in_200ms_ease-out] motion-reduce:open:animate-none",
      )}
    >
      <div className="flex flex-col gap-6">
        <div className={cn("flex flex-col", icon && "gap-4")}>
          {icon && <IconTile icon={icon} tone={tone ?? "brand"} size="md" />}
          <div className="flex flex-col gap-1.5">
            <h2 id="modal-title" tabIndex={-1} autoFocus className="text-h2 text-text-primary outline-none focus-visible:shadow-none">
              {title}
            </h2>
            {description && <p className="text-body-m text-text-secondary">{description}</p>}
          </div>
        </div>
        {children}
        <div className="flex items-center justify-end gap-2.5">{actions}</div>
      </div>
    </dialog>
  );
}
