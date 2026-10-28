"use client";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { regionOf, type Alert, type Severity } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";

export type AlertFilter = {
  fraudTypes: string[];
  regions: string[];
  /** Money out, in cedis. */
  amountMin: number | null;
  amountMax: number | null;
};

export const NO_FILTER: AlertFilter = { fraudTypes: [], regions: [], amountMin: null, amountMax: null };

/** Selected values, as the Filters button and the panel header count them. */
export const filterCount = (f: AlertFilter) =>
  f.fraudTypes.length + f.regions.length + (f.amountMin !== null || f.amountMax !== null ? 1 : 0);

// TODO(api): alerts carry no source (MoMo, Network, CRM), so the panel’s Source group isn’t offered.
const FRAUD_TYPES: Array<[string, string]> = [
  ["momo_velocity", "MoMo fraud"],
  ["sim_swap_to_momo", "SIM swap"],
  ["sim_box_bypass", "Bypass (SIM box)"],
  ["account_takeover", "Account takeover"],
  ["wangiri", "Wangiri"],
];
const REGIONS = ["Greater Accra", "Ashanti", "Central", "Volta and others"];
const AMOUNTS: Array<[string, number | null]> = [["Any", null], ["1,000+", 1000], ["5,000+", 5000], ["10,000+", 10000]];

/** The panel groups the smaller regions together. */
export const regionBucket = (a: Alert) => {
  const r = regionOf(a.region);
  return REGIONS.includes(r) ? r : "Volta and others";
};

export function matchesFilter(a: Alert, f: AlertFilter) {
  if (f.fraudTypes.length && !f.fraudTypes.includes(a.fraud_type)) return false;
  if (f.regions.length && !f.regions.includes(regionBucket(a))) return false;
  if (f.amountMin !== null || f.amountMax !== null) {
    const out = (a.money_out?.amount_minor ?? 0) / 100;
    if (f.amountMin !== null && out < f.amountMin) return false;
    if (f.amountMax !== null && out > f.amountMax) return false;
  }
  return true;
}

/** Toolbar search — 32 high, for the Filter bar (global search stays in the top bar). */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  label,
  wide,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  /** Fill the width (in a modal) instead of the toolbar’s 280. */
  wide?: boolean;
}) {
  return (
    <label className={cn(wide ? "w-full" : "w-[280px]", "flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus")}>
      <Icon name="app/icon-search-tertiary-16" size={16} />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-body-s text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
      />
    </label>
  );
}

const SEGMENT_DOT: Record<Severity, string> = {
  critical: "bg-critical-solid",
  high: "bg-high-solid",
  medium: "bg-medium-solid",
  low: "bg-neutral-solid",
};

/** Segment chips — one selected at a time; the dot is the only colour. */
export function SegmentChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string; count: number; severity?: Severity }>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 whitespace-nowrap",
              active
                ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand"
                : "border-border-default bg-surface-base text-text-primary hover:bg-surface-raised",
            )}
          >
            {o.severity && !active && <span aria-hidden className={cn("size-1.5 rounded-full", SEGMENT_DOT[o.severity])} />}
            <span className="text-label-s">{o.label}</span>
            <span className={cn("text-body-s", active ? "text-text-brand" : "text-text-tertiary")}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** B16/B17 · Filter button + panel — fraud type, region, amount at risk. Changes apply on “Show N alerts”. */
export function AlertFilterButton({
  value,
  onChange,
  alerts,
  onSaveView,
}: {
  value: AlertFilter;
  onChange: (f: AlertFilter) => void;
  alerts: Alert[];
  onSaveView: (f: AlertFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = filterCount(value);
  const draftCount = filterCount(draft);
  const shown = alerts.filter((a) => matchesFilter(a, draft)).length;

  const toggle = (key: "fraudTypes" | "regions", id: string, on: boolean) =>
    setDraft((d) => ({ ...d, [key]: on ? [...d[key], id] : d[key].filter((x) => x !== id) }));

  const option = (key: "fraudTypes" | "regions", id: string, label: string, n: number) => (
    <div key={id} className="flex h-7 items-center justify-between gap-3">
      <Checkbox
        label={label}
        className="text-body-s"
        checked={draft[key].includes(id)}
        onChange={(e) => toggle(key, id, e.target.checked)}
      />
      <span className="text-caption text-text-tertiary">{n}</span>
    </div>
  );

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border pr-2 pl-3 text-label-s",
          count
            ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand"
            : "border-border-strong bg-surface-base text-text-primary hover:bg-surface-raised",
        )}
      >
        <Icon name={count ? "app/icon-filter-brand-16" : "app/icon-filter-secondary-16"} size={16} />
        Filters
        {count > 0 && <span className="text-body-s">{count}</span>}
        <Icon name={count ? "app/icon-chevron-down-brand-16" : "app/icon-chevron-down-tertiary-16"} size={16} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Filters"
          className="absolute top-[calc(100%+8px)] left-0 z-30 flex max-h-[min(640px,calc(100vh-200px))] w-[310px] flex-col rounded-lg border border-border-default bg-surface-base shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <p className="text-label-s text-text-primary">Filters</p>
            <span className="text-caption text-text-tertiary">{draftCount} selected</span>
          </div>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-3">
            <fieldset className="flex flex-col">
              <legend className="mb-1.5 text-caption text-text-tertiary">Fraud type</legend>
              {FRAUD_TYPES.map(([id, label]) => option("fraudTypes", id, label, alerts.filter((a) => a.fraud_type === id).length))}
            </fieldset>
            <fieldset className="flex flex-col">
              <legend className="mb-1.5 text-caption text-text-tertiary">Region</legend>
              {REGIONS.map((r) => option("regions", r, r, alerts.filter((a) => regionBucket(a) === r).length))}
            </fieldset>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1.5 text-caption text-text-tertiary">Amount at risk (GHS)</legend>
              <div className="flex gap-1.5">
                {AMOUNTS.map(([label, min]) => {
                  const on = draft.amountMin === min && draft.amountMax === null;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDraft((d) => ({ ...d, amountMin: min, amountMax: null }))}
                      className={cn(
                        "flex h-8 items-center rounded-lg border px-3 text-body-s",
                        on
                          ? "border-brand-primary-subtle-hover bg-brand-primary-subtle text-text-brand"
                          : "border-border-default text-text-primary hover:bg-surface-raised",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {(["amountMin", "amountMax"] as const).map((key) => (
                  <label key={key} className="flex min-w-0 flex-1 flex-col gap-1.5 text-label-s text-text-primary">
                    {key === "amountMin" ? "Min" : "Max"}
                    <input
                      inputMode="numeric"
                      placeholder={key === "amountMin" ? "0" : "No limit"}
                      value={draft[key] === null ? "" : draft[key]!.toLocaleString("en-GB")}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^\d]/g, ""));
                        setDraft((d) => ({ ...d, [key]: e.target.value.trim() === "" ? null : n }));
                      }}
                      className="h-9 w-full min-w-0 rounded-lg border border-border-strong px-3 text-body-s font-normal text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-focus focus:shadow-focus"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex items-center gap-2 border-t border-border-default px-4 py-3">
            <button type="button" onClick={() => setDraft(NO_FILTER)} className="rounded text-label-s text-text-brand hover:underline">
              Clear all
            </button>
            <span className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => onSaveView(draft)} disabled={!draftCount}>
              Save as view
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Show {shown} {shown === 1 ? "alert" : "alerts"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
