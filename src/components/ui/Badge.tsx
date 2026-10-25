import { cn } from "@/lib/cn";

const tones = {
  critical: { bg: "bg-critical-bg", fg: "text-critical-fg", dot: "bg-critical-fg" },
  high: { bg: "bg-high-bg", fg: "text-high-fg", dot: "bg-high-fg" },
  medium: { bg: "bg-medium-bg", fg: "text-medium-fg", dot: "bg-medium-fg" },
  success: { bg: "bg-success-bg", fg: "text-success-fg", dot: "bg-success-fg" },
  info: { bg: "bg-info-bg", fg: "text-info-fg", dot: "bg-info-fg" },
  neutral: { bg: "bg-neutral-bg", fg: "text-neutral-fg", dot: "bg-neutral-fg" },
  brand: { bg: "bg-brand-primary-subtle", fg: "text-text-brand", dot: "bg-text-brand" },
} as const;

export type BadgeTone = keyof typeof tones;

/** Badge — status words, never colour only. */
export function Badge({
  label,
  tone,
  size = "sm",
  dot = false,
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-caption font-medium" : "px-2.5 py-1 text-label-s",
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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
        env === "test" ? "bg-medium-bg text-medium-fg" : "bg-success-bg text-success-fg",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", env === "test" ? "bg-medium-fg" : "bg-success-fg")}
      />
      {env === "test" ? "Test environment" : "Production"}
    </span>
  );
}
