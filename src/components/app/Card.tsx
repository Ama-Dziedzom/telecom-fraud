import { Icon } from "@/components/ui/Icon";
import { cn, fullWidthUnless } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

/** Card — radius 12 · padding 18/20 · border/subtle. Title row: icon 18 + Title style. */
export function Card({
  title,
  icon,
  aside,
  children,
  className,
  id,
}: {
  title?: ReactNode;
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
        "flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-base px-5 py-[18px]",
        fullWidthUnless(className),
        className,
      )}
    >
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-title text-text-primary">
            {icon && <Icon name={icon} size={18} />}
            {title}
          </h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** “View in Cases →” style card link. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-1.5 rounded text-label-s text-text-brand hover:underline">
      {children}
      <Icon name="app/icon-arrow-right-brand-14" size={14} />
    </Link>
  );
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

/** Tab — label + optional count; active tab underlined brand. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex items-end gap-5 border-b border-border-default">
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
              "-mb-px flex items-center gap-2 px-1 py-3 text-label-m",
              active ? "border-b-2 border-brand-primary text-text-brand" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-[7px] py-px text-caption font-medium",
                  active ? "bg-brand-primary-subtle text-text-brand" : "bg-surface-sunken text-text-secondary",
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
  return <span aria-hidden className={cn("block animate-pulse rounded-md bg-surface-sunken", className)} />;
}
