import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  /** Visually hide the label (it’s still read out). */
  hideLabel?: boolean;
  indeterminate?: boolean;
};

/** Checkbox — 18px box, brand fill when on, a dash when some are selected. */
export function Checkbox({ label, hideLabel, indeterminate = false, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-body-m text-text-primary", className)}>
      <span className="relative flex size-[18px] shrink-0">
        <input
          type="checkbox"
          ref={(el) => {
            if (el) el.indeterminate = indeterminate;
          }}
          className="peer size-full cursor-pointer appearance-none rounded-[5px] border-[1.25px] border-border-strong bg-surface-base checked:border-brand-primary checked:bg-brand-primary indeterminate:border-brand-primary indeterminate:bg-brand-primary focus-visible:shadow-focus"
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center peer-checked:flex">
          <Icon name="icon-check-white-14" size={14} />
        </span>
        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center peer-indeterminate:flex">
          <span className="h-[1.75px] w-2 rounded-full bg-text-inverse" />
        </span>
      </span>
      <span className={cn(hideLabel && "sr-only")}>{label}</span>
    </label>
  );
}

/** Checkbox card — box + title + description; selected = brand subtle + 1.5px brand border. */
export function CheckCard({
  title,
  description,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "title"> & { title: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-[10px] border border-border-default bg-surface-base px-3.5 py-3",
        "has-checked:border-[1.5px] has-checked:border-brand-primary has-checked:bg-brand-primary-subtle has-focus-visible:shadow-focus",
        "has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <span className="relative mt-px flex size-[18px] shrink-0">
        <input
          type="checkbox"
          className="peer size-full cursor-pointer appearance-none rounded-[5px] border-[1.25px] border-border-strong bg-surface-base checked:border-brand-primary checked:bg-brand-primary focus-visible:shadow-none disabled:cursor-not-allowed"
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center peer-checked:flex">
          <Icon name="icon-check-white-14" size={14} />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label-m text-text-primary">{title}</span>
        {description && <span className="text-body-s text-text-secondary">{description}</span>}
      </span>
    </label>
  );
}

type OptionCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "title"> & {
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  invalid?: boolean;
  /** Line the description up with the title instead of the radio. */
  indent?: boolean;
};

/**
 * Option card — Radio + title + description; selected = brand/primary-subtle
 * + 1.5px brand border. The whole card is the hit area.
 */
export function OptionCard({ title, badge, description, invalid, indent, className, ...props }: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-start rounded-xl border bg-surface-base px-4 py-3.5",
        invalid ? "border-critical-fg" : "border-border-default",
        "has-checked:border-[1.5px] has-checked:border-brand-primary has-checked:bg-brand-primary-subtle",
        "has-focus-visible:shadow-focus",
        className,
      )}
    >
      <span className="flex flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-2.5 text-body-m text-text-primary">
            <input
              type="radio"
              className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-[1.25px] border-border-strong bg-surface-base checked:border-[5px] checked:border-brand-primary focus-visible:shadow-none"
              {...props}
            />
            {title}
          </span>
          {badge}
        </span>
        {description && <span className={cn("text-body-s text-text-secondary", indent && "pl-7")}>{description}</span>}
      </span>
    </label>
  );
}
