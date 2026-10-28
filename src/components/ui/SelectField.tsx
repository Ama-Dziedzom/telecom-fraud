import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";

/** Native select styled as an Input (LG), with optional left icon and a chevron. */
export function SelectField({
  label,
  iconLeft,
  children,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; iconLeft?: ReactNode }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={selectId} className="text-label-s text-text-primary">
        {label}
      </label>
      <div className="relative flex h-12 w-full items-center gap-2.5 rounded-lg border border-border-strong bg-surface-base px-3.5 focus-within:border-[1.5px] focus-within:border-border-focus focus-within:shadow-focus">
        {iconLeft}
        <select
          id={selectId}
          className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-body-l text-text-primary outline-none focus-visible:shadow-none"
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none flex">
          <Icon name="icon-chevron-down" size={18} />
        </span>
      </div>
    </div>
  );
}
