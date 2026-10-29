"use client";

import { cn } from "@/lib/cn";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Set by a compact Menu so its items and dividers take the row actions menu spec. */
const Compact = createContext(false);

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
  compact,
}: {
  trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" }) => ReactNode;
  children: (close: () => void) => ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  width?: number;
  label: string;
  /** Foundations · Row actions menu (1318:165788): 4 padding, 8 radius, 32-high Body/S items with 16 icons. */
  compact?: boolean;
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
            "absolute z-40 flex flex-col border border-border-default bg-surface-base shadow-lg",
            compact ? "rounded-lg p-1" : "gap-0.5 rounded-xl p-1.5",
            side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <Compact.Provider value={!!compact}>{children(() => setOpen(false))}</Compact.Provider>
        </div>
      )}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-2 pb-1 text-overline text-text-tertiary uppercase">{children}</p>;
}

export function MenuDivider() {
  const compact = useContext(Compact);
  return <hr className={compact ? "my-1 border-border-default" : "my-0.5 border-border-subtle"} />;
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
  const compact = useContext(Compact);
  if (compact)
    return (
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded px-2 text-left text-body-s disabled:cursor-not-allowed disabled:opacity-50",
          tone === "critical" ? "text-critical-fg hover:bg-critical-bg focus-visible:bg-critical-bg" : "text-text-primary hover:bg-surface-sunken focus-visible:bg-surface-sunken",
        )}
      >
        {icon && <Icon name={icon} size={16} className="shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>
    );
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
