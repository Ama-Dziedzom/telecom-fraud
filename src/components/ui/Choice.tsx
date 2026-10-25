import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode };

/** Checkbox — 18px box, brand fill when on. */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-body-m text-text-primary", className)}>
      <span className="relative flex size-[18px] shrink-0">
        <input
          type="checkbox"
          className="peer size-full cursor-pointer appearance-none rounded-[5px] border-[1.25px] border-border-strong bg-surface-base checked:border-brand-primary checked:bg-brand-primary focus-visible:shadow-focus"
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center peer-checked:flex">
          <Icon name="icon-check-white-14" size={14} />
        </span>
      </span>
      {label}
    </label>
  );
}

type OptionCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  title: ReactNode;
  badge?: ReactNode;
  description: ReactNode;
};

/**
 * Option card — Radio + title + description; selected = brand/primary-subtle
 * + 1.5px brand border. The whole card is the hit area.
 */
export function OptionCard({ title, badge, description, className, ...props }: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-start rounded-xl border border-border-default bg-surface-base px-4 py-3.5",
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
        <span className="text-body-s text-text-secondary">{description}</span>
      </span>
    </label>
  );
}
