"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { CardSkeleton, money, StatTile } from "@/components/subscriber/ProfileParts";
import { Button } from "@/components/ui/Button";
import { Select, TextField } from "@/components/ui/TextField";
import { TooltipBubble, tooltipOnHover } from "@/components/ui/Tooltip";
import { usePatterns, type Patterns } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { TZ, formatClock, useNow } from "@/lib/time";
import { useDeferredValue, useState } from "react";

export const MAX_GHS = 20_000;
const DAY = 86_400_000;
const FINDING: Record<string, string> = { burst: "Burst", fan_out: "Fan-out", drain: "Drain" };

const PLOT_H = 220;
const AXIS_W = 76;

/** Every transfer as a dot by amount and time; his normal band at the bottom, today’s column shaded. */
function TransfersChart({ data, days, now }: { data: Patterns; days: number; now: number }) {
  const end = Math.floor(now / DAY) * DAY + DAY;
  const start = end - days * DAY;
  const peak = Math.max(...data.transfers.map((t) => t.amount.amount_minor), 1);
  const yMax = Math.max(4000_00, Math.ceil(peak / 1000_00) * 1000_00);
  // Round ticks: every GHS 1,000 up to 5,000 (C26), else quarters of the axis.
  const step = yMax <= 5000_00 ? 1000_00 : yMax / 4;
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const x = (iso: string) => ((Date.parse(iso) - start) / (end - start)) * 100;
  const y = (minor: number) => Math.min(1, minor / yMax) * PLOT_H;
  const currency = data.normal_max.currency;
  const dayLabels = Array.from({ length: days }, (_, i) => start + i * DAY);
  // At most ~7 day labels, counted back from today, so 30 days don’t crowd each other.
  const every = Math.ceil(days / 7);

  return (
    <div className="relative h-[270px]" role="img" aria-label={`Every transfer over the last ${days} days by amount`}>
      {ticks.map((v) => (
        <span key={v} className="absolute right-0 h-px bg-border-default" style={{ left: AXIS_W, top: 10 + PLOT_H - y(v) }}>
          <span className="absolute right-full mr-2 -translate-y-1/2 text-caption whitespace-nowrap text-text-secondary">
            {currency} {(v / 100).toLocaleString("en-GB")}
          </span>
        </span>
      ))}
      <div className="absolute top-2.5 right-0" style={{ left: AXIS_W, height: PLOT_H }}>
        <span className="absolute inset-x-0 bottom-0 bg-surface-raised" style={{ height: Math.max(8, y(data.normal_max.amount_minor)) }}>
          <span className="absolute bottom-full left-2 z-10 mb-0.5 rounded bg-surface-base/90 px-1 text-caption whitespace-nowrap text-text-secondary">
            His normal transfers: under {money(data.normal_max)}
          </span>
        </span>
        <span className="absolute inset-y-0 bg-critical-bg opacity-60" style={{ left: `${((days - 1) / days) * 100}%`, right: 0 }} />
        {data.transfers.map((t) => (
          <span
            key={t.at}
            className={cn("group/tip absolute -translate-x-1/2 translate-y-1/2 rounded-full", t.flagged ? "size-2 bg-critical-solid" : "size-2 bg-border-strong")}
            style={{ left: `${x(t.at)}%`, bottom: y(t.amount.amount_minor) }}
          >
            <TooltipBubble title={formatClock(t.at)} body={money(t.amount)} className={tooltipOnHover("top")} />
          </span>
        ))}
      </div>
      <div className="absolute right-0 flex" style={{ left: AXIS_W, top: 238 }}>
        {dayLabels.map((d, i) => (
          <span key={d} className={cn("flex min-w-0 flex-1 text-caption whitespace-nowrap", i === days - 1 ? "text-critical-fg" : "text-text-secondary", i === days - 1 && every > 1 ? "justify-end" : "justify-center")}>
            {i === days - 1
              ? "Today"
              : (days - 1 - i) % every === 0 && days - 1 - i >= every
                ? every > 1
                  ? `${new Date(d).toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ })} ${new Date(d).toLocaleDateString("en-GB", { month: "short", timeZone: TZ }).slice(0, 3)}`
                  : new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: TZ })
                : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The default query, shared with the standalone page’s header. */
export const DEFAULT_PATTERNS_QUERY = `direction=out&days=7&min=0&max=${MAX_GHS}`;

/**
 * C26 · Transaction patterns — period and amount filters, every transfer out
 * by amount, and what stands out. Used by the subscriber’s Transactions tab
 * and the standalone check.
 */
export function PatternsView({ id }: { id: string }) {
  const now = useNow();
  const [days, setDays] = useState("7");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(MAX_GHS);
  const query = useDeferredValue(`direction=out&days=${days}&min=${min}&max=${max}`);
  const { data } = usePatterns(id, query);
  const cluster = data?.cluster;
  if (!data) return <CardSkeleton />;
  return (
        <>
          <div className="flex items-end gap-3">
            <Select label="Period" value={days} onChange={(e) => setDays(e.target.value)} className="w-[200px] shrink-0">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </Select>
            <TextField
              size="md"
              label="Min (GHS)"
              inputMode="numeric"
              value={min.toLocaleString("en-GB")}
              onChange={(e) => setMin(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="w-[160px] shrink-0"
            />
            <TextField
              size="md"
              label="Max (GHS)"
              inputMode="numeric"
              value={max.toLocaleString("en-GB")}
              onChange={(e) => setMax(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="w-[160px] shrink-0"
            />
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setMin(0);
                setMax(MAX_GHS);
                setDays("7");
              }}
            >
              Clear filters
            </Button>
          </div>

          <Card
            title="Every transfer out, by amount"
            aside={
              cluster ? (
                <CardMeta>
                  Today: {cluster.count} transfers, {money(cluster.total)} in {cluster.minutes} min
                </CardMeta>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-3">
              <TransfersChart data={data} days={Number(days)} now={now} />
              <div className="flex gap-4 text-caption text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-border-strong" /> Usual transfer
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-critical-solid" /> Flagged transfer
                </span>
              </div>
            </div>
          </Card>

          {data.findings.length > 0 && (
            <div className="flex gap-3">
              {data.findings.map((f) => (
                <StatTile key={f.kind} label={FINDING[f.kind] ?? f.kind.replace(/_/g, " ")} value={f.headline} sub={f.detail} />
              ))}
            </div>
          )}
        </>
  );
}
