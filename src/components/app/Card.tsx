import { Icon } from "@/components/ui/Icon";
import { cn, fullWidthUnless } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Card — white, 1px border, radius 8, no shadow. Header: Title 16 with
 * optional meta or link on the right (`aside`); no icon on the title
 * (Figma rule 6, so `icon` is ignored). Body has 24 side padding.
 */
export function Card({
  title,
  aside,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  /** @deprecated Direction v2 cards carry no title icon. */
  icon?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border-default bg-surface-base px-6 pt-5 pb-5",
        fullWidthUnless(className),
        className,
      )}
    >
      {(title || aside) && (
        <div className="-mb-2 flex min-h-8 items-center justify-between gap-4">
          <h3 className="text-title text-text-primary">{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Card header link — Label/S brand, no arrow. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex h-8 w-fit items-center rounded text-label-s text-text-brand hover:underline">
      {children}
    </Link>
  );
}

/** Card header meta — Caption, tertiary. */
export function CardMeta({ children }: { children: ReactNode }) {
  return <span className="text-caption text-text-tertiary">{children}</span>;
}

/** KPI card — Label/S + H1 value + Caption Medium sub-line + icon. */
export function KpiCard({
  label,
  value,
  sub,
  subTone = "secondary",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subTone?: "secondary" | "success" | "critical" | "medium";
  icon: string;
}) {
  const tones = {
    secondary: "text-text-secondary",
    success: "text-success-fg",
    critical: "text-critical-fg",
    medium: "text-medium-fg",
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border-subtle bg-surface-base px-5 py-[18px]">
      <div className="flex items-center justify-between">
        <span className="text-label-s text-text-secondary">{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <span className="text-h1 text-text-primary">{value}</span>
      {sub && <span className={cn("text-caption font-medium", tones[subTone])}>{sub}</span>}
    </div>
  );
}

/**
 * Tabs — underline tabs, Label/S, 40 high, 24 apart; 2px underline on the
 * active item. `surface="canvas"` (page header) uses the strong divider.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  surface = "base",
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  surface?: "base" | "canvas";
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex items-end gap-6 border-b", surface === "canvas" ? "border-border-strong" : "border-border-default")}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-label-s",
              active ? "border-brand-primary text-text-brand" : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full border px-1.5 text-caption font-medium",
                  active ? "border-transparent bg-brand-primary-subtle text-text-brand" : "border-border-default bg-surface-base text-text-secondary",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Skeleton block — shimmer left → right, 1400 ms loop. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded bg-border-default", className)} />;
}
