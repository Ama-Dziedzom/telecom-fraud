import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

const TILES = {
  critical: "bg-critical-bg",
  medium: "bg-medium-bg",
  success: "bg-success-bg",
  brand: "bg-brand-primary-subtle",
  neutral: "bg-surface-sunken",
} as const;

/**
 * Empty / error state — 56 tile + H3 + Body/M (460 wide) + actions, centred
 * in a card. Optional meta line (error ID, retry note) underneath.
 */
export function EmptyState({
  icon,
  tone,
  title,
  children,
  actions,
  meta,
  className,
  size = "lg",
}: {
  icon: string;
  tone: keyof typeof TILES;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
  /** md: 44 tile, Title — for states inside a card or panel. */
  size?: "lg" | "md";
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3.5 rounded-xl border border-border-subtle bg-surface-base px-8 text-center", className)}>
      <span className={cn("flex items-center justify-center", size === "lg" ? "size-14 rounded-2xl" : "size-11 rounded-xl", TILES[tone])}>
        <Icon name={icon} size={size === "lg" ? 26 : 22} />
      </span>
      <h2 className={cn("text-text-primary", size === "lg" ? "text-h3" : "text-title")}>{title}</h2>
      {children && <p className={cn("max-w-[460px] text-text-secondary", size === "lg" ? "text-body-m" : "text-body-s")}>{children}</p>}
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      {meta}
    </div>
  );
}

/** “Error ID ERR-… · 20 Oct 09:42 · Quote this if you raise an IT ticket” */
export function ErrorId({ id, at }: { id: string; at?: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-caption text-text-tertiary">
      Error ID <span className="font-mono text-mono-s text-text-secondary">{id}</span>
      {at ? ` · ${at}` : ""} · Quote this if you raise an IT ticket
    </p>
  );
}
