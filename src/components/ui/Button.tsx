import { cn } from "@/lib/cn";
import Image from "next/image";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
type ButtonSize = "lg" | "md" | "sm";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  CommonProps & {
    loading?: boolean;
    /** Label shown next to the spinner while loading (e.g. “Checking your organisation…”). */
    loadingLabel?: ReactNode;
  };

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-pressed",
  secondary:
    "bg-surface-base text-text-primary border border-border-strong hover:bg-surface-raised",
  ghost: "bg-transparent text-text-brand hover:bg-brand-primary-subtle",
  danger: "bg-critical-fg text-text-inverse hover:brightness-95",
  "danger-outline":
    "bg-surface-base text-critical-fg border border-critical-border hover:bg-critical-bg",
};

const sizes: Record<ButtonSize, string> = {
  lg: "h-12 gap-2 px-5 text-label-m",
  md: "h-10 gap-2 px-4 text-label-m",
  sm: "h-8 gap-1.5 px-3 text-label-s",
};

function buttonClasses({
  variant = "primary",
  size = "lg",
  fullWidth,
  disabled,
  className,
}: CommonProps & { disabled?: boolean; className?: string }) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg whitespace-nowrap transition-colors",
    sizes[size],
    disabled ? "icon-tint cursor-not-allowed bg-surface-sunken text-text-disabled" : variants[variant],
    fullWidth && "w-full",
    className,
  );
}

const spinners = {
  white: { src: "/figma/auth/spinner-white.svg", size: 18 },
  brand: { src: "/figma/auth/spinner-brand-20.svg", size: 20 },
} as const;

export function Spinner({ tone = "white" }: { tone?: keyof typeof spinners }) {
  const { src, size } = spinners[tone];
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="animate-spin motion-reduce:animate-none"
    />
  );
}

/**
 * Button — Primary (one per view), Secondary, Ghost, Danger, Danger outline.
 * Loading replaces the icon with a spinner and blocks double submit.
 */
export function Button({
  variant,
  size,
  iconLeft,
  iconRight,
  loading = false,
  loadingLabel,
  fullWidth,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({
        variant,
        size,
        fullWidth,
        disabled: disabled && !loading,
        className: cn(loading && "cursor-progress", className),
      })}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {iconLeft}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
}

/** A link styled as a Button, for navigation-only actions. */
export function ButtonLink({
  variant,
  size,
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & CommonProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}
