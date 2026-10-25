"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Menu — a button that opens a list of actions. Closes on Esc, on a click
 * outside and after choosing. Opens above the button when `side="top"`.
 */
export function Menu({
  trigger,
  children,
  side = "bottom",
  align = "end",
  width = 340,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  children: (close: () => void) => ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  width?: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu" })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          style={{ width }}
          className={cn(
            "absolute z-40 flex flex-col gap-0.5 rounded-xl border border-border-default bg-surface-base p-1.5 shadow-lg",
            side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-2 pb-1 text-overline text-text-tertiary uppercase">{children}</p>;
}

export function MenuDivider() {
  return <hr className="my-0.5 border-border-subtle" />;
}

export function MenuItem({
  icon,
  title,
  description,
  onSelect,
  tone = "default",
  disabled,
}: {
  icon?: string;
  title: ReactNode;
  description?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "critical";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-[9px] text-left hover:bg-surface-sunken focus-visible:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon && <Icon name={icon} size={18} className="mt-0.5 shrink-0" />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-body-m font-medium", tone === "critical" ? "text-critical-fg" : "text-text-primary")}>{title}</span>
        {description && <span className="text-caption text-text-secondary">{description}</span>}
      </span>
    </button>
  );
}
