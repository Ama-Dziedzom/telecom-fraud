"use client";

import { cn } from "@/lib/cn";

/** Segmented control — sunken track, raised white segment for the current value. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string; count?: number; dot?: string }>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5 rounded-[10px] bg-surface-sunken p-[3px]">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-s",
              active ? "bg-surface-base text-text-primary shadow-[0_1px_1px_rgb(20_18_51/0.06)]" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {o.dot && <span aria-hidden className={cn("size-1.5 rounded-full", o.dot)} />}
            {o.label}
            {o.count !== undefined && <span className="text-caption font-medium text-text-tertiary">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
