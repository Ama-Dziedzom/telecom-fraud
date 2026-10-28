"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatClock, formatWhen } from "@/lib/time";
import type { ReactNode } from "react";

/** “+233 54 *** 3457” → “054 *** 3457”, the way analysts read Ghanaian numbers. */
export const localMsisdn = (msisdn: string) => msisdn.replace(/^\+233\s?/, "0");

/** 22 min · 2 h 05 min */
export function duration(ms: number) {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** “09:25” today, “yesterday 16:20”, “18 Oct 16:20”. */
export function whenAt(iso: string, now: number) {
  const day = formatWhen(iso, now);
  const clock = formatClock(iso);
  return day === clock ? clock : `${day === "Yesterday" ? "yesterday" : day} ${clock}`;
}

export const firstName = (name?: string | null) => name?.split(" ")[0] ?? "";

/** Banner action — a brand text link on the right of a Banner (“Retry now”, “Withdraw”). */
export function BannerLink({
  onClick,
  children,
  disabled,
  title,
  busy,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className="shrink-0 rounded px-2 text-label-s whitespace-nowrap text-text-brand hover:underline disabled:cursor-not-allowed disabled:text-text-disabled disabled:no-underline"
    >
      {children}
    </button>
  );
}

/** Stat tile — raised, 1px border, radius 8; Caption label, H2 value, optional Caption tertiary line. */
export function StatTile({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised p-4", className)}>
      <span className="truncate text-caption text-text-secondary">{label}</span>
      <span className="truncate text-h2 text-text-primary">{value}</span>
      {sub && <span className="truncate text-caption text-text-tertiary">{sub}</span>}
    </div>
  );
}

/** Detail rows — Body/S label left, value right, dividers between. */
export function DetailRows({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex min-h-10 items-center justify-between gap-4 border-b border-border-default py-2 last:border-b-0">
          <dt className="text-body-s text-text-secondary">{k}</dt>
          <dd className="text-right text-body-s text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Choice chips (Outcome, Priority, Duration) — 32 high, radius 8; the chosen one brand-subtle. */
export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              "h-8 rounded-lg border px-3 text-label-s",
              on
                ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand"
                : "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** 36 raised tile with an 18 icon — used in step and evidence rows. */
export function RowTile({ icon, size = 18, tone = "raised" }: { icon: string; size?: number; tone?: "raised" | "critical" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg border",
        tone === "critical" ? "border-critical-border bg-surface-base" : "border-border-default bg-surface-raised",
      )}
    >
      <Icon name={icon} size={size} />
    </span>
  );
}

/** Table wrapper + header cell + row classes from the Foundations table rules. */
export const table = {
  wrap: "overflow-hidden rounded-lg border border-border-default bg-surface-base",
  head: "h-10 border-b border-border-default bg-surface-raised text-left text-caption text-text-secondary",
  row: "h-14 border-b border-border-default last:border-b-0 hover:bg-surface-sunken",
  foot: "flex h-14 items-center border-t border-border-default px-4 text-caption text-text-secondary",
};

export type StepState = "done" | "current" | "todo" | "failed";

/**
 * Numbered progress list (D3 applying, D9 reversal): done steps tick, the current
 * one is a brand number in an outlined row, the rest are outlined numbers.
 */
export function StepList({ steps }: { steps: Array<{ state: StepState; label: ReactNode; detail?: ReactNode }> }) {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((s, i) => (
        <li
          key={i}
          aria-current={s.state === "current" ? "step" : undefined}
          className={cn("flex items-center gap-3 rounded-lg px-1.5 py-1.5", s.state === "current" && "border border-border-default bg-surface-base")}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-caption font-medium",
              s.state === "done" && "bg-brand-primary-subtle",
              s.state === "current" && "bg-brand-primary text-text-inverse",
              s.state === "todo" && "border border-border-strong text-text-secondary",
              s.state === "failed" && "bg-critical-solid",
            )}
          >
            {s.state === "done" ? (
              <Icon name="app/icon-check-brand-22" size={12} />
            ) : s.state === "failed" ? (
              <Icon name="app/icon-x-white-18" size={10} />
            ) : (
              i + 1
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn("text-body-s", s.state === "failed" ? "text-critical-fg" : "text-text-primary")}>{s.label}</span>
            {s.detail && <span className={cn("text-caption", s.state === "failed" ? "text-critical-fg" : "text-text-secondary")}>{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
