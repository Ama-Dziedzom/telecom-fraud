"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { CheckLayout } from "@/components/subscriber/CheckLayout";
import { money, StatTile } from "@/components/subscriber/ProfileParts";
import { Button } from "@/components/ui/Button";
import { Select, TextField } from "@/components/ui/TextField";
import { useSubscriber } from "@/lib/api/fd";
import { usePatterns, type Patterns } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { TZ, formatClock, useNow } from "@/lib/time";
import { useParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

const MAX_GHS = 20_000;
const DAY = 86_400_000;
const FINDING: Record<string, string> = { burst: "Burst", fan_out: "Fan-out", drain: "Drain" };

const PLOT_H = 220;
const AXIS_W = 56;

/** Every transfer as a dot by amount and time; his normal band at the bottom, today’s column shaded. */
function TransfersChart({ data, days, now }: { data: Patterns; days: number; now: number }) {
  const end = Math.floor(now / DAY) * DAY + DAY;
  const start = end - days * DAY;
  const peak = Math.max(...data.transfers.map((t) => t.amount.amount_minor), 1);
  const yMax = Math.max(4000_00, Math.ceil(peak / 1000_00) * 1000_00);
  const ticks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);
  const x = (iso: string) => ((Date.parse(iso) - start) / (end - start)) * 100;
  const y = (minor: number) => Math.min(1, minor / yMax) * PLOT_H;
  const currency = data.normal_max.currency;
  const dayLabels = Array.from({ length: days }, (_, i) => start + i * DAY);

  return (
    <div className="relative h-[270px]" role="img" aria-label={`Every transfer over the last ${days} days by amount`}>
      {ticks.map((v) => (
        <span key={v} className="absolute right-0 h-px bg-border-default" style={{ left: AXIS_W, top: 10 + PLOT_H - y(v) }}>
          <span className="absolute -translate-y-1/2 text-caption whitespace-nowrap text-text-secondary" style={{ left: -AXIS_W }}>
            {currency} {(v / 100).toLocaleString("en-GB")}
          </span>
        </span>
      ))}
      <div className="absolute top-2.5 right-0" style={{ left: AXIS_W, height: PLOT_H }}>
        <span className="absolute inset-x-0 bottom-0 bg-surface-raised" style={{ height: Math.max(8, y(data.normal_max.amount_minor)) }}>
          <span className="absolute bottom-full left-2 mb-0.5 text-caption whitespace-nowrap text-text-secondary">
            His normal transfers: under {money(data.normal_max)}
          </span>
        </span>
        <span className="absolute inset-y-0 bg-critical-bg opacity-60" style={{ left: `${((days - 1) / days) * 100}%`, right: 0 }} />
        {data.transfers.map((t) => (
          <span
            key={t.at}
            title={`${formatClock(t.at)} · ${money(t.amount)}`}
            className={cn("absolute -translate-x-1/2 translate-y-1/2 rounded-full", t.flagged ? "size-[11px] bg-critical-solid" : "size-[9px] bg-border-strong")}
            style={{ left: `${x(t.at)}%`, bottom: y(t.amount.amount_minor) }}
          />
        ))}
      </div>
      <div className="absolute right-0 flex" style={{ left: AXIS_W, top: 238 }}>
        {dayLabels.map((d, i) => (
          <span key={d} className={cn("flex-1 text-center text-caption", i === days - 1 ? "text-critical-fg" : "text-text-secondary")}>
            {i === days - 1 ? "Today" : new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: TZ })}
          </span>
        ))}
      </div>
    </div>
  );
}

/** C26 · Transaction patterns — every transfer out, by amount, with what stands out. */
export default function PatternsPage() {
  const { id } = useParams<{ id: string }>();
  const now = useNow();
  const { data: sub } = useSubscriber(id);
  const [days, setDays] = useState("7");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(MAX_GHS);
  const query = useDeferredValue(`direction=out&days=${days}&min=${min}&max=${max}`);
  const { data, isLoading } = usePatterns(id, query);
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
      )}
    </CheckLayout>
  );
}
