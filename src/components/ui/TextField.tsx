import { cn, fullWidthUnless } from "@/lib/cn";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  /** Rendered at the right end of the label row, e.g. “Forgot password?” */
  labelAction?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Error styling without a message (the message lives elsewhere, e.g. a rule list). */
  invalid?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  size?: "lg" | "md";
  mono?: boolean;
};

/**
 * Input — label above, hint below; Error shows the message below with an icon.
 */
export function TextField({
  label,
  labelAction,
  hint,
  error,
  invalid = false,
  iconLeft,
  iconRight,
  size = "lg",
  mono = false,
  disabled,
  id,
  className,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error || hint;
  const isInvalid = Boolean(error) || invalid;

  return (
    <div className={cn("flex flex-col gap-1.5", fullWidthUnless(className), className)}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={inputId} className="text-label-s text-text-primary">
            {label}
          </label>
          {labelAction}
        </div>
      )}
      <div
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3.5 transition-shadow",
          size === "lg" ? "h-12" : "h-10",
          disabled
            ? "border border-border-default bg-surface-sunken"
            : isInvalid
              ? "border-[1.5px] border-critical-fg bg-surface-base"
              : "border border-border-default bg-surface-base hover:border-border-strong focus-within:border-[1.5px] focus-within:border-border-focus focus-within:shadow-focus",
        )}
      >
        {iconLeft}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-tertiary focus-visible:shadow-none",
            disabled ? "text-text-disabled" : "text-text-primary",
            mono
              ? "font-mono text-mono-m"
              : size === "lg"
                ? "text-body-l"
                : "text-body-m",
          )}
          {...props}
        />
        {iconRight}
      </div>
      {message && (
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          className={cn(
            "flex items-start gap-1.5 text-caption",
            error ? "text-critical-fg" : "text-text-secondary",
          )}
        >
          <Icon
            name={error ? "icon-alert-critical" : "icon-info-secondary"}
            size={14}
            className="mt-0.5 shrink-0"
          />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}

/** Text area — same chrome as the input; label with an optional “optional” marker. */
export function TextArea({
  label,
  optional,
  required,
  error,
  className,
  id,
  rows = 3,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> & {
  label: ReactNode;
  optional?: boolean;
  error?: ReactNode;
}) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", fullWidthUnless(className), className)}>
      <label htmlFor={areaId} className="flex items-center gap-1 text-label-s text-text-primary">
        {label}
        {optional && <span className="text-caption text-text-tertiary">optional</span>}
        {required && <span className="text-critical-fg">*</span>}
      </label>
      <textarea
        id={areaId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "w-full resize-none rounded-lg border bg-surface-base px-3 py-2.5 text-body-m text-text-primary outline-none placeholder:text-text-tertiary",
          error
            ? "border-[1.5px] border-critical-fg"
            : "border-border-default hover:border-border-strong focus:border-[1.5px] focus:border-border-focus focus:shadow-focus",
        )}
        {...props}
      />
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-caption text-critical-fg">
          <Icon name="icon-alert-critical" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Field label row: “Reason *” or “Note optional”. */
export function FieldLabel({ children, required, optional, htmlFor }: { children: ReactNode; required?: boolean; optional?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1 text-label-s text-text-primary">
      {children}
      {required && <span className="text-critical-fg">*</span>}
      {optional && <span className="text-caption text-text-tertiary">optional</span>}
    </label>
  );
}

/** Compact select (40 high) used inside modals and filter rows. */
export function Select({
  label,
  required,
  iconLeft,
  className,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; iconLeft?: ReactNode }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", fullWidthUnless(className), className)}>
      {label && (
        <FieldLabel htmlFor={selectId} required={required}>
          {label}
        </FieldLabel>
      )}
      <div className="relative flex h-10 w-full items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 hover:border-border-strong focus-within:border-[1.5px] focus-within:border-border-focus focus-within:shadow-focus">
        {iconLeft}
        <select
          id={selectId}
          required={required}
          className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-body-m text-text-primary outline-none focus-visible:shadow-none"
          {...props}
        >
          {children}
        </select>
        <Icon name="app/icon-chevron-down-16" size={16} className="pointer-events-none shrink-0" />
      </div>
    </div>
  );
}
