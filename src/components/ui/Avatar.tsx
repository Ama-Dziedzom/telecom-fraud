import { cn } from "@/lib/cn";

const sizes = {
  24: "size-6 text-caption font-medium",
  32: "size-8 text-label-s",
  40: "size-10 text-label-s",
} as const;

export function Avatar({
  initials,
  size = 24,
  className,
}: {
  initials: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-primary-subtle text-text-brand",
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
