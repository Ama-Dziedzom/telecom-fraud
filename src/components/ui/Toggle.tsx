import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

/** Toggle — 36×20 track, brand when on. A checkbox underneath, so it’s keyboard- and form-friendly. */
export function Toggle({ label, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-body-m text-text-primary", className)}>
      <span className="relative flex h-5 w-9 shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors checked:bg-brand-primary focus-visible:shadow-focus"
          {...props}
        />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-surface-base shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  );
}
