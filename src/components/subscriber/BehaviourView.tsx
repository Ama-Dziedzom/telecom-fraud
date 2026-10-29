"use client";

import { Card, CardMeta } from "@/components/app/Card";
import { CardSkeleton, money } from "@/components/subscriber/ProfileParts";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { TooltipBubble, tooltipOnHover } from "@/components/ui/Tooltip";
import { useSubscriber } from "@/lib/api/fd";
import { useBehaviour, type Behaviour } from "@/lib/api/subscribers";
import { cn } from "@/lib/cn";
import { formatDate, TZ } from "@/lib/time";

/** The five signals in the design’s order, with how each one reads. */
export const SIGNALS: Array<{ key: keyof Behaviour["signals"]; label: string; usual: (s: Behaviour["signals"]) => string; today: (s: Behaviour["signals"]) => string }> = [
  { key: "place", label: "Where", usual: (s) => s.place.usual, today: (s) => s.place.today },
  { key: "device", label: "Device", usual: (s) => s.device.usual, today: (s) => s.device.today },
  {
    key: "active_hours",
    label: "Active hours",
    usual: (s) => `${s.active_hours.usual.from}-${s.active_hours.usual.to}`,
    today: (s) => `${s.active_hours.today.from}-${s.active_hours.today.to}`,
  },
  { key: "average_transfer", label: "Average transfer", usual: (s) => money(s.average_transfer.usual), today: (s) => money(s.average_transfer.today) },
  {
    key: "recipients",
    label: "Recipients",
    usual: (s) => `${s.recipients.usual} regulars`,
    today: (s) => (s.recipients.today_new === s.recipients.today ? `${s.recipients.today} never paid` : `${s.recipients.today} · ${s.recipients.today_new} new`),
  },
];

/** “GHS 18k” */
const shortMoney = (m: { amount_minor: number; currency: string }) => {
  const v = m.amount_minor / 100;
  return v >= 1000 ? `${m.currency} ${Math.round(v / 1000)}k` : money(m);
};
/** “29 Sep” — three-letter months (en-GB writes “Sept”). */
const day = (iso: string) => {
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: TZ }).slice(0, 3);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ })} ${month}`;
};

/** Money out per day: ordinary days against his normal band, today breaking out of it. */
function DailyChart({ data }: { data: Behaviour }) {
  const days = data.daily;
  const today = days[days.length - 1];
  const normal = data.normal_max.amount_minor || 1;
  // 200px plot: the normal band is the bottom 60px; today fills the plot.
  const BAND = 60;
  const PLOT = 196;
  const marks = [0, Math.round((days.length - 1) / 3), Math.round(((days.length - 1) * 2) / 3)];
  return (
    <div className="relative h-[232px]" role="img" aria-label={`Money out per day for the last ${days.length} days; today ${money(today.amount)}`}>
      {/* Axis labels end 8px before the plot, so a wide amount never runs into the bars. */}
      <span className="absolute top-0 right-[calc(100%-48px)] text-caption whitespace-nowrap text-text-secondary">{shortMoney(today.amount)}</span>
      <span className="absolute right-[calc(100%-48px)] -translate-y-1/2 text-caption whitespace-nowrap text-text-secondary" style={{ top: 200 - BAND }}>
        {shortMoney(data.normal_max)}
      </span>
      <span className="absolute top-[186px] right-[calc(100%-48px)] text-caption whitespace-nowrap text-text-secondary">{data.normal_max.currency} 0</span>
      <div className="absolute top-0 right-0 left-14 h-[200px]">
        <span className="absolute inset-x-0 bottom-0 bg-surface-raised" style={{ height: BAND }} />
        <div className="relative flex h-full items-end gap-2">
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            return (
              <span
                key={d.date}
                className={cn("group/tip relative min-w-0 flex-1 rounded-t-sm", isToday ? "bg-critical-solid" : "bg-border-strong")}
                style={{ height: isToday ? PLOT : Math.max(4, Math.min(PLOT, (d.amount.amount_minor / normal) * BAND)) }}
              >
                {!isToday && <TooltipBubble title={formatDate(d.date)} body={money(d.amount)} className={tooltipOnHover("top")} />}
                {isToday && (
                  <span className="absolute top-0 right-full mr-3 text-caption font-medium whitespace-nowrap text-critical-fg">{money(d.amount)}</span>
                )}
              </span>
            );
          })}
        </div>
        {/* Just above the band, on a backing so a bar near his normal can’t run through it. */}
        <span className="pointer-events-none absolute left-2 rounded bg-surface-base/90 px-1 text-caption whitespace-nowrap text-text-secondary" style={{ bottom: BAND + 4 }}>
          His normal: up to {money(data.normal_max)} a day
        </span>
      </div>
      <div className="absolute top-[206px] right-0 left-14 flex gap-2">
        {days.map((d, i) => (
          <span key={d.date} className={cn("min-w-0 flex-1 text-caption whitespace-nowrap", i === days.length - 1 ? "text-critical-fg" : "text-text-secondary")}>
            {i === days.length - 1 ? "Today" : marks.includes(i) ? day(d.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for C20 · loading: a row of signal tiles, the chart, two cards. */
export function BehaviourSkeleton() {
  return (
    <>
      <div className="flex gap-3">
        {SIGNALS.map((s) => (
          <CardSkeleton key={s.key} className="min-w-0 flex-1" />
        ))}
      </div>
      <CardSkeleton />
      <div className="flex gap-6">
        <CardSkeleton className="min-w-0 flex-1" />
        <CardSkeleton className="min-w-0 flex-1" />
      </div>
    </>
  );
}

/**
 * C19/C20 · Behaviour profile — normal vs now: the five signals, money out
 * per day against his normal band, when and where he uses MoMo, and the
 * verdict. Used by the subscriber’s Activity tab and the standalone check.
 */
export function BehaviourView({ id }: { id: string }) {
  const { data: sub } = useSubscriber(id);
  const { data } = useBehaviour(id);
  const openCase = sub?.cases.find((c) => c.status !== "closed");
  const today = data?.daily[data.daily.length - 1];
  const times = data && today ? Math.round(today.amount.amount_minor / (data.normal_max.amount_minor || 1)) : 0;
  if (!data) return <BehaviourSkeleton />;
  return (
    <>
          <div className="flex gap-3">
            {SIGNALS.map((s) => {
              const odd = data.signals[s.key].unusual;
              return (
                <div key={s.key} className="flex min-w-0 flex-1 flex-col items-start gap-3 rounded-lg border border-border-default bg-surface-base p-4">
                  <span className="text-label-s text-text-primary">{s.label}</span>
                  <span className="flex max-w-full gap-4">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-caption text-text-secondary">Usual</span>
                      <span className="truncate text-body-s text-text-primary">{s.usual(data.signals)}</span>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-caption text-text-secondary">Today</span>
                      <span className="truncate text-body-s text-text-primary">{s.today(data.signals)}</span>
                    </span>
                  </span>
                  <Badge label={odd ? "Unusual" : "Normal"} tone={odd ? "critical" : "success"} />
                </div>
              );
            })}
          </div>

          <Card title={`Money out per day · last ${data.daily.length} days`} aside={times > 1 ? <CardMeta>Today is {times}× his normal</CardMeta> : undefined}>
            <DailyChart data={data} />
          </Card>

          <div className="flex items-stretch gap-6">
            <Card title="When he uses MoMo" className="min-w-0 flex-1">
              <div className="flex flex-col gap-3">
                <div className="flex gap-1">
                  {Array.from({ length: 24 }, (_, h) => (
                    <span
                      key={h}
                      className={cn(
                        "group/tip relative size-[22px] rounded",
                        data.hours.today.includes(h) ? "bg-text-secondary" : data.hours.usual.includes(h) ? "bg-border-strong" : "bg-surface-raised",
                      )}
                    >
                      <TooltipBubble title={`${String(h).padStart(2, "0")}:00`} className={tooltipOnHover("top")} />
                    </span>
                  ))}
                </div>
                <div className="flex">
                  {["00", "03", "06", "09", "12", "15", "18", "21"].map((h) => (
                    <span key={h} className="w-[78px] text-caption text-text-secondary">
                      {h}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4 text-caption text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[2px] bg-border-strong" /> Usual hours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[2px] bg-text-secondary" /> Active today
                  </span>
                </div>
              </div>
            </Card>
            <Card title="Where he uses MoMo" className="min-w-0 flex-1">
              <ul className="flex flex-col gap-3.5">
                {data.places.map((p) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="w-[140px] shrink-0 truncate text-body-s text-text-primary">{p.today_only ? `${p.name} (today only)` : p.name}</span>
                    <span className="h-1.5 w-[200px] shrink-0 rounded-[3px] bg-surface-raised">
                      <span className={cn("block h-1.5 rounded-[3px]", p.today_only ? "bg-critical-solid" : "bg-border-strong")} style={{ width: `${p.share_pct}%` }} />
                    </span>
                    <span className={cn("w-10 shrink-0 text-right text-body-s", p.today_only ? "text-critical-fg" : "text-text-secondary")}>{p.share_pct}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {data.verdict && (
            <Banner
              tone="error"
              title={data.verdict.title}
              action={
                openCase && (
                  <ButtonLink href={`/cases/${openCase.id}`} variant="ghost" size="sm">
                    Go to {openCase.id}
                  </ButtonLink>
                )
              }
            >
              {data.verdict.detail}
            </Banner>
          )}
        </>
  );
}
