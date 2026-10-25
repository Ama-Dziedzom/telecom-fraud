"use client";

import { Card } from "@/components/app/Card";
import { CheckLayout } from "@/components/subscriber/CheckLayout";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select, TextField } from "@/components/ui/TextField";
import { usePatterns, useSubscriber360 } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { TZ, formatClock, formatMoney } from "@/lib/time";
import { useParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

const MAX_GHS = 20_000;
const FINDING_ICON = { burst: "app/icon-zap-critical-16", fanout: "app/icon-users-critical-16", drain: "app/icon-wallet-critical-16" };

/** C26 · Transaction patterns — every transfer out, by amount, with what stands out. */
export default function PatternsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sub } = useSubscriber360(id);
  const [direction, setDirection] = useState("out");
  const [days, setDays] = useState("7");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(MAX_GHS);
  const query = useDeferredValue(`direction=${direction}&days=${days}&min=${min}&max=${max}`);
  const { data, isLoading } = usePatterns(id, query);

  // Axis: GHS 0–4,000 in 1,000 steps; the last 7 days left to right, today on the right.
  const yMax = 4000_00;
  const start = Date.parse("2026-10-14T00:00:00Z");
  const end = start + Number(days) * 86_400_000;
  const x = (iso: string) => ((Date.parse(iso) - start) / (end - start)) * 100;
  const y = (minor: number) => Math.min(100, (minor / yMax) * 100);
  const dayLabels = Array.from({ length: Number(days) }, (_, i) => start + i * 86_400_000);
  const cluster = data?.cluster;

  return (
    <CheckLayout
      subscriberId={id}
      section="Transaction patterns"
      title="Transaction patterns"
      status={data ? { label: `${data.findings.length} patterns found`, tone: data.findings.length ? "critical" : "success" } : undefined}
      subtitle={sub ? `${sub.name} · MoMo wallet · last ${days} days` : undefined}
      evidenceTitle="Transaction patterns"
      exportLabel="Export chart"
      loading={isLoading && !data}
    >
      {data && (
        <>
          <div className="flex items-end gap-4 rounded-xl border border-border-subtle bg-surface-base px-4 py-3.5">
            <Select label="Show" value={direction} onChange={(e) => setDirection(e.target.value)} className="w-[180px] shrink-0">
              <option value="out">Money out</option>
              <option value="in">Money in</option>
            </Select>
            <Select label="Period" value={days} onChange={(e) => setDays(e.target.value)} className="w-[180px] shrink-0">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </Select>
            <label className="flex w-[300px] shrink-0 flex-col gap-3">
              <span className="text-label-s text-text-secondary">Amount range</span>
              <span className="relative flex h-4 items-center">
                <span className="absolute inset-x-0 h-1 rounded-[2px] bg-surface-sunken" />
                <span className="absolute h-1 rounded-[2px] bg-brand-primary" style={{ left: `${(min / MAX_GHS) * 100}%`, right: `${100 - (max / MAX_GHS) * 100}%` }} />
                <input
                  type="range"
                  aria-label="Minimum amount"
                  min={0}
                  max={MAX_GHS}
                  step={100}
                  value={min}
                  onChange={(e) => setMin(Math.min(Number(e.target.value), max))}
                  className="range-thumb pointer-events-none absolute inset-x-0 appearance-none bg-transparent"
                />
                <input
                  type="range"
                  aria-label="Maximum amount"
                  min={0}
                  max={MAX_GHS}
                  step={100}
                  value={max}
                  onChange={(e) => setMax(Math.max(Number(e.target.value), min))}
                  className="range-thumb pointer-events-none absolute inset-x-0 appearance-none bg-transparent"
                />
              </span>
            </label>
            <TextField size="md" label="Min (GHS)" inputMode="numeric" value={String(min)} onChange={(e) => setMin(Number(e.target.value.replace(/\D/g, "")) || 0)} className="w-[140px] shrink-0" />
            <TextField
              size="md"
              label="Max (GHS)"
              inputMode="numeric"
              value={max.toLocaleString("en-GB")}
              onChange={(e) => setMax(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="w-[140px] shrink-0"
            />
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setMin(0);
                setMax(MAX_GHS);
                setDirection("out");
                setDays("7");
              }}
            >
              Clear filters
            </Button>
          </div>

          <Card title="Every transfer out, by amount" icon="app/icon-chart-secondary-18">
            <div className="relative h-[260px]">
              {[0, 1000, 2000, 3000, 4000].map((v) => (
                <span key={v} className="absolute right-0 left-16 h-px bg-border-subtle" style={{ bottom: `calc(30px + ${(v / 4000) * 220}px)` }}>
                  <span className="absolute -left-16 -translate-y-1/2 font-mono text-mono-s text-text-tertiary">GHS {v.toLocaleString("en-GB")}</span>
                </span>
              ))}
              <div className="absolute top-2.5 right-0 bottom-[30px] left-16">
                <span className="absolute inset-x-0 bottom-0 bg-success-bg" style={{ height: `${y(data.normal_max.amount_minor)}%` }}>
                  <span className="absolute bottom-full left-2 mb-1 text-caption font-medium whitespace-nowrap text-success-fg">
                    His normal transfers: under {formatMoney(data.normal_max.amount_minor, data.normal_max.currency)}
                  </span>
                </span>
                {cluster && (
                  <span className="absolute top-0 bottom-0 bg-critical-bg" style={{ left: `${x(cluster.from) - 0.6}%`, width: `${x(cluster.to) - x(cluster.from) + 1.2}%` }} />
                )}
                {data.transfers.map((t) => (
                  <span
                    key={t.at}
                    title={`${formatClock(t.at)} · ${formatMoney(t.amount.amount_minor, t.amount.currency)}`}
                    className={cn("absolute -translate-x-1/2 translate-y-1/2 rounded-full", t.flagged ? "size-3.5 bg-critical-fg" : "size-2.5 bg-brand-highlight")}
                    style={{ left: `${x(t.at)}%`, bottom: `${y(t.amount.amount_minor)}%` }}
                  />
                ))}
                {cluster && (
                  <span
                    className="absolute flex -translate-x-full flex-col gap-0.5 rounded-lg bg-surface-inverse px-2.5 py-2 text-text-inverse"
                    style={{ left: `${x(cluster.from) - 1}%`, top: "10%" }}
                  >
                    <span className="text-label-s">
                      {cluster.count} transfers in {cluster.minutes} minutes
                    </span>
                    <span className="font-mono text-mono-s">
                      {formatMoney(cluster.total.amount_minor, cluster.total.currency)} · {formatClock(cluster.from)}-{formatClock(cluster.to)}
                    </span>
                  </span>
                )}
              </div>
              <div className="absolute right-0 bottom-0 left-16 h-[22px]">
                {dayLabels.map((d, i) => (
                  <span
                    key={d}
                    className={cn("absolute font-mono text-mono-s", i === dayLabels.length - 1 ? "text-critical-fg" : "text-text-tertiary")}
                    style={{ left: `${(i / dayLabels.length) * 100 + 1.5}%` }}
                  >
                    {i === dayLabels.length - 1 ? "Today" : new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: TZ })}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-[18px] text-caption text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-brand-highlight" /> Normal transfer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-critical-fg" /> Flagged transfer
              </span>
            </div>
          </Card>

          <div className="flex gap-3">
            {data.findings.map((f) => (
              <section key={f.kind} className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-critical-border bg-surface-base px-[18px] py-4">
                <h3 className="flex items-center gap-2.5 text-title text-text-primary">
                  <span className="flex size-8 items-center justify-center rounded-[10px] bg-critical-bg">
                    <Icon name={FINDING_ICON[f.kind]} size={16} />
                  </span>
                  {f.title}
                </h3>
                <p className="text-h3 text-critical-fg">{f.headline}</p>
                <p className="text-body-s text-text-secondary">{f.detail}</p>
              </section>
            ))}
          </div>
        </>
      )}
    </CheckLayout>
  );
}
