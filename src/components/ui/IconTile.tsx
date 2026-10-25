import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

const tones = {
  brand: "bg-brand-primary-subtle",
  neutral: "bg-surface-sunken",
  critical: "bg-critical-bg",
  success: "bg-success-bg",
  medium: "bg-medium-bg",
} as const;

export type IconTileTone = keyof typeof tones;

/** 52 × 52 tile at the top of auth screens; 48 × 48 in modals. */
export function IconTile({
  icon,
  tone,
  size = "lg",
}: {
  icon: string;
  tone: IconTileTone;
  size?: "lg" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "lg" ? "size-[52px] rounded-[14px]" : "size-12 rounded-xl",
        tones[tone],
      )}
    >
      <Icon name={icon} size={size === "lg" ? 24 : 22} />
    </span>
  );
}
