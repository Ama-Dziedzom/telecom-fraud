import { cn } from "@/lib/cn";

const tones = {
  critical: { bg: "bg-critical-bg border-critical-border", fg: "text-critical-fg", dot: "bg-critical-fg" },
  high: { bg: "bg-high-bg border-high-border", fg: "text-high-fg", dot: "bg-high-fg" },
  medium: { bg: "bg-medium-bg border-medium-border", fg: "text-medium-fg", dot: "bg-medium-fg" },
  success: { bg: "bg-success-bg border-success-border", fg: "text-success-fg", dot: "bg-success-fg" },
  info: { bg: "bg-info-bg border-info-border", fg: "text-info-fg", dot: "bg-info-fg" },
  neutral: { bg: "bg-neutral-bg border-neutral-border", fg: "text-neutral-fg", dot: "bg-neutral-fg" },
  brand: { bg: "bg-brand-primary-subtle border-brand-primary-subtle-hover", fg: "text-text-brand", dot: "bg-text-brand" },
} as const;

export type BadgeTone = keyof typeof tones;

/**
 * Badge — status pill, the only place status colour appears: fill, 1px border
 * and text from the tone triplet, with a dot. SM 22 for tables, MD 26 for headers.
 */
export function Badge({
  label,
  tone,
  size = "sm",
  dot = true,
}: {
  label: string;
  tone: BadgeTone;
  size?: "sm" | "md";
  dot?: boolean;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 whitespace-nowrap",
        size === "sm" ? "py-px text-caption font-medium" : "py-[3px] text-label-s",
        t.bg,
        t.fg,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", t.dot)} />}
      {label}
    </span>
  );
}

/** Environment — Production / Test pill. */
export function EnvironmentPill({ env }: { env: "production" | "test" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-px text-caption font-medium",
        env === "test" ? "border-medium-border bg-medium-bg text-medium-fg" : "border-success-border bg-success-bg text-success-fg",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", env === "test" ? "bg-medium-fg" : "bg-success-fg")}
      />
      {env === "test" ? "Test environment" : "Production"}
    </span>
  );
}
