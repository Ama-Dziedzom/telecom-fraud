import { cn } from "@/lib/cn";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
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
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
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
