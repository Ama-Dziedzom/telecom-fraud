"use client";

import { Skeleton } from "@/components/app/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { TooltipBubble } from "@/components/ui/Tooltip";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Stat tile — surface raised, radius 8, 1px border, no tint. Caption label,
 * H2 value in text primary, optional delta line in words (tertiary, no colour).
 */
export function StatTile({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised p-4">
      <span className="truncate text-caption text-text-secondary">{label}</span>
      <span className="truncate text-h2 text-text-primary">{value}</span>
      {delta && <span className="truncate text-caption text-text-tertiary">{delta}</span>}
    </div>
  );
}

/** H2/H5 · Stat tile while loading — grey bars in the tile chrome. */
export function StatTileSkeleton() {
  return (
    <div aria-hidden className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
      <Skeleton className="h-2.5 w-[72px]" />
      <Skeleton className="h-[18px] w-[120px]" />
      <Skeleton className="h-2.5 w-[90px]" />
    </div>
  );
}

/** H2/H5 · A card while loading — title bar and three lines, no spinner. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-busy className={cn("flex flex-col gap-3 rounded-lg border border-border-default bg-surface-base px-6 pt-6 pb-6", className)}>
      <Skeleton className="mb-2 h-3.5 w-[140px]" />
      <Skeleton className="h-2.5 w-[70%]" />
      <Skeleton className="h-2.5 w-[60%]" />
      <Skeleton className="h-2.5 w-[44%]" />
    </div>
  );
}

const CHIP = {
  on: "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand",
  off: "border-border-default bg-surface-base text-text-primary hover:bg-surface-sunken",
};

/** Segment chip — 32 high, radius 8, Label/S. Selected = brand subtle. For multi-select, use `aria-pressed`. */
export function Chip({ selected, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button type="button" className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-label-s", selected ? CHIP.on : CHIP.off, className)} {...props}>
      {children}
    </button>
  );
}

/** Row of segment chips, one selected at a time. */
export function SegmentChips<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ id: T; label: string }> }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-2">
      {options.map((o) => (
        <Chip key={o.id} role="radio" aria-checked={o.id === value} selected={o.id === value} onClick={() => onChange(o.id)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/**
 * Labelled bars — label and value on top, a 6px track under; fills scale to the
 * largest value. One measure, so one neutral ink (no series colour).
 */
export function LabelledBars({ items, label }: { items: Array<{ key: string; label: string; value: number; display: string }>; label: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul aria-label={label} className="flex flex-col gap-3.5">
      {items.map((i) => (
        <li key={i.key} className="flex flex-col gap-1.5">
          <span className="flex items-start gap-2 text-text-primary">
            <span className="min-w-0 flex-1 text-body-s">{i.label}</span>
            <span className="text-label-s whitespace-nowrap">{i.display}</span>
          </span>
          <span aria-hidden className="flex h-1.5 overflow-hidden rounded-[3px] bg-surface-raised">
            <span className="h-1.5 rounded-[3px] bg-text-secondary" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Detail rows — key secondary left, value primary right, hairline under (none on the last). */
export function DetailRows({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="flex flex-col text-body-s">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex h-10 items-start gap-4 border-b border-border-default py-2.5 last:border-b-0">
          <dt className="min-w-0 flex-1 text-text-secondary">{k}</dt>
          <dd className="text-right whitespace-nowrap text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Empty / error state inside a card or table — neutral 40 icon tile, Title,
 * one Body/S line, up to two actions. Errors stay neutral (no red): the
 * request failed, not the page.
 */
export function InlineState({ icon, title, children, actions, role }: { icon: string; title: string; children: ReactNode; actions?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role} className="flex flex-col items-center gap-4 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border-default bg-surface-raised">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-title text-text-primary">{title}</span>
        <span className="text-body-s text-text-secondary">{children}</span>
      </span>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** H3 · A widget that failed on its own — error state with one Retry. */
export function WidgetError({ title, children, onRetry }: { title: string; children: ReactNode; onRetry: () => void }) {
  return (
    <InlineState
      role="alert"
      icon="app/icon-alert-circle-tertiary-20"
      title={title}
      actions={
        <Button variant="secondary" size="md" onClick={onRetry} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
          Retry
        </Button>
      }
    >
      {children}
    </InlineState>
  );
}

/** Legend item — 8px swatch in a chart colour plus a Caption label. */
export function LegendItem({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-text-secondary">
      <span aria-hidden className={cn("size-2 rounded-[2px]", swatch)} />
      {children}
    </span>
  );
}

/** 52 → 60, 7 → 8: a round top for the y axis that halves cleanly. */
function niceMax(max: number) {
  if (max <= 0) return 2;
  const p = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 4, 5, 6, 8, 10].find((s) => s * p >= max) ?? 10;
  const top = step * p;
  return top % 2 ? top + p : top;
}

/**
 * H4 · Chart card plot — one series of columns in chart-1 on a 240 plot, y axis
 * at 0 / half / top, a label under each column. Each column is focusable and
 * shows its value on hover or focus; a hidden table carries the same numbers.
 */
export function ColumnChart({ data, unit, label }: { data: Array<{ key: string; label: string; value: number }>; unit: string; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...data.map((d) => d.value)));
  return (
    <figure className="flex gap-2">
      <div aria-hidden className="flex h-60 w-12 shrink-0 flex-col items-end justify-between text-right text-caption text-text-secondary">
        <span>{top}</span>
        <span>{top / 2}</span>
        <span>0</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="relative flex h-60 items-end justify-between gap-1 border-b border-border-default" onPointerLeave={() => setActive(null)}>
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-border-subtle" />
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border-subtle" />
          {data.map((d, i) => (
            <span key={d.key} className="relative flex h-full max-w-8 min-w-0 flex-1 items-end justify-center">
              <button
                type="button"
                aria-label={`${d.label}: ${d.value} ${unit}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="absolute inset-y-0 -inset-x-1 rounded-sm focus-visible:shadow-focus"
              />
              <span
                aria-hidden
                className={cn("pointer-events-none w-full rounded-t-[4px] bg-chart-1 transition-opacity", active !== null && active !== i && "opacity-60")}
                style={{ height: `${(d.value / top) * 100}%` }}
              />
              {active === i && (
                <TooltipBubble
                  title={d.label}
                  body={`${d.value} ${unit}`}
                  placement={i >= data.length - 2 ? "top-end" : "top"}
                  className={cn("absolute z-10", i >= data.length - 2 ? "right-1/2 -mr-[17px]" : "left-1/2 -translate-x-1/2")}
                  style={{ bottom: `calc(${(d.value / top) * 100}% + 4px)` }}
                />
              )}
            </span>
          ))}
        </div>
        <div aria-hidden className="flex justify-between gap-1">
          {data.map((d, i) => (
            <span key={d.key} className="flex max-w-8 min-w-0 flex-1 justify-center overflow-visible text-caption whitespace-nowrap text-text-secondary">
              {data.length <= 10 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Chart card — white, 24 padding, Title + meta on the left, legend on the right. */
export function ChartCard({ title, meta, legend, children, className }: { title: string; meta?: ReactNode; legend?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-5 rounded-lg border border-border-default bg-surface-base p-6", className)}>
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-title text-text-primary">{title}</h3>
          {meta && <p className="text-caption text-text-tertiary">{meta}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}
