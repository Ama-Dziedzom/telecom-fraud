"use client";

import { cn } from "@/lib/cn";

/**
 * Filter chips — 32 high, radius 8, 1px border, Label/S; the current one is
 * brand-subtle with brand text. Used by ⌘K (I1), the notifications popover
 * (I3), feedback (I13) and account preferences (I10).
 */
export function Chips<T extends string>({
  label,
  value,
  onChange,
  options,
  mode = "filter",
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string; count?: number }>;
  /** filter: toggle buttons (aria-pressed) · choice: a radio group. */
  mode?: "filter" | "choice";
}) {
  return (
    <div role={mode === "choice" ? "radiogroup" : "group"} aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role={mode === "choice" ? "radio" : undefined}
            aria-checked={mode === "choice" ? active : undefined}
            aria-pressed={mode === "filter" ? active : undefined}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-label-s whitespace-nowrap",
              active
                ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand"
                : "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("text-caption font-medium", active ? "text-text-brand" : "text-text-tertiary")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
