"use client";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { FAMILY_LABELS, alertFamily, regionOf, type Alert } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";

export type AlertFilter = {
  families: string[];
  regions: string[];
  /** Minimum amount at risk in cedis (server-side: amount_min_minor). */
  amountMin: number | null;
  amountMax: number | null;
};

export const NO_FILTER: AlertFilter = { families: [], regions: [], amountMin: null, amountMax: null };

export const filterCount = (f: AlertFilter) =>
  (f.families.length ? 1 : 0) + (f.regions.length ? 1 : 0) + (f.amountMin !== null || f.amountMax !== null ? 1 : 0);

const FAMILIES = ["momo_fraud", "sim_swap", "sim_box_bypass", "account_takeover", "wangiri"];
const REGIONS = ["Greater Accra", "Ashanti", "Central", "Volta & others"];
const AMOUNTS: Array<[string, number | null]> = [["Any", null], ["1,000+", 1000], ["5,000+", 5000], ["10,000+", 10000]];

/** The panel groups the smaller regions together. */
export const regionBucket = (a: Alert) => {
  const r = regionOf(a.region);
  return REGIONS.includes(r) ? r : "Volta & others";
};

export function matchesFilter(a: Alert, f: AlertFilter) {
  if (f.families.length && !f.families.includes(alertFamily(a))) return false;
  if (f.regions.length && !f.regions.includes(regionBucket(a))) return false;
  return true;
}

/** B16/B17 · Filter panel — fraud type, region, amount at risk. Changes apply on “Show N alerts”. */
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
  const draftCount = draft.families.length + draft.regions.length + (draft.amountMin !== null || draft.amountMax !== null ? 1 : 0);
  const shown = alerts.filter((a) => matchesFilter(a, draft)).length;

  const toggle = (key: "families" | "regions", id: string, on: boolean) =>
    setDraft((d) => ({ ...d, [key]: on ? [...d[key], id] : d[key].filter((x) => x !== id) }));

  return (
    <div ref={root} className="relative">
      <Button
        variant="secondary"
        size="md"
        aria-expanded={open}
        onClick={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        iconLeft={<Icon name="app/icon-filter-18" size={18} />}
      >
        {count ? `Filters · ${count}` : "Filters"}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Filters"
          className="absolute top-[calc(100%+8px)] right-0 z-30 flex w-[340px] flex-col rounded-xl border border-border-default bg-surface-base shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <p className="text-label-m text-text-primary">Filters</p>
            <span className="text-caption text-text-tertiary">{draftCount} selected</span>
          </div>
          <div className="flex flex-col gap-4 px-4 py-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-overline text-text-tertiary uppercase">Fraud type</legend>
              {FAMILIES.map((f) => (
                <div key={f} className="flex items-center justify-between">
                  <Checkbox
                    label={FAMILY_LABELS[f]}
                    className="text-body-s"
                    checked={draft.families.includes(f)}
                    onChange={(e) => toggle("families", f, e.target.checked)}
                  />
                  <span className="text-caption text-text-tertiary">{alerts.filter((a) => alertFamily(a) === f).length}</span>
                </div>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-overline text-text-tertiary uppercase">Region</legend>
              {REGIONS.map((r) => (
                <div key={r} className="flex items-center justify-between">
                  <Checkbox
                    label={r}
                    className="text-body-s"
                    checked={draft.regions.includes(r)}
                    onChange={(e) => toggle("regions", r, e.target.checked)}
                  />
                  <span className="text-caption text-text-tertiary">{alerts.filter((a) => regionBucket(a) === r).length}</span>
                </div>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-overline text-text-tertiary uppercase">Amount at risk (GHS)</legend>
              <div className="flex gap-1.5">
                {AMOUNTS.map(([label, min]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={draft.amountMin === min && draft.amountMax === null}
                    onClick={() => setDraft((d) => ({ ...d, amountMin: min, amountMax: null }))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-caption font-medium",
                      draft.amountMin === min && draft.amountMax === null
                        ? "border-brand-primary bg-brand-primary-subtle text-text-brand"
                        : "border-border-default text-text-secondary hover:bg-surface-raised",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(["amountMin", "amountMax"] as const).map((key) => (
                  <label key={key} className="flex min-w-0 flex-1 flex-col gap-1 text-caption text-text-secondary">
                    {key === "amountMin" ? "Min" : "Max"}
                    <input
                      inputMode="numeric"
                      placeholder={key === "amountMin" ? "0" : "No limit"}
                      value={draft[key] === null ? "" : draft[key]!.toLocaleString("en-GB")}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^\d]/g, ""));
                        setDraft((d) => ({ ...d, [key]: e.target.value.trim() === "" ? null : n }));
                      }}
                      className="h-9 w-full min-w-0 rounded-lg border border-border-default px-2.5 font-mono text-mono-s text-text-primary outline-none placeholder:text-text-primary focus:border-border-focus focus:shadow-focus"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex items-center gap-2 border-t border-border-subtle px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setDraft(NO_FILTER)}>
              Clear all
            </Button>
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

