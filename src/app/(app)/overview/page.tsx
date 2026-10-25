"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Card, Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { riskTone } from "@/components/app/indicators";
import { fraudTypeLabel, useApi, type Money, type Overview, type OverviewKpi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, formatSpan, TZ, useNow } from "@/lib/time";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Tone = "critical" | "high" | "medium" | "success" | "neutral";
type Today = Extract<Overview, { period: "today" }>;
type Week = Extract<Overview, { period: "7d" | "30d" }>;
type Sla = {
  period: string;
  first_response_within_sla_pct: number;
  first_response: { met: number; total: number };
  critical_closed_within_4h_pct: number;
  critical_closed: { met: number; total: number };
  sent_back: number;
  sent_back_case_ids: string[];
};

const TEXT: Record<Tone, string> = { critical: "text-critical-fg", high: "text-high-fg", medium: "text-medium-fg", success: "text-success-fg", neutral: "text-text-primary" };
const BAR: Record<Tone, string> = { critical: "bg-critical-fg", high: "bg-high-fg", medium: "bg-medium-fg", success: "bg-success-fg", neutral: "bg-brand-primary" };
const MIX = ["bg-critical-fg", "bg-high-fg", "bg-medium-fg", "bg-brand-primary", "bg-border-strong"];

const count = (k: OverviewKpi, field: string) => k.breakdown[field] as number | undefined;
const money = (k: OverviewKpi, field: string) => k.breakdown[field] as Money | undefined;
const showMoney = (m: Money | null | undefined) => (m ? formatMoney(m.amount_minor, m.currency) : "–");

/** 128 · GHS 41,200 · 6 min · 2h 41m · 31% */
function kpiValue(k: OverviewKpi) {
  if (k.unit === "money") return showMoney(k.money);
  if (k.value === null) return "–";
  if (k.unit === "minutes") return k.value < 60 ? `${k.value} min` : formatSpan(k.value * 60_000);
  if (k.unit === "percent") return `${k.value}%`;
  return String(k.value);
}

const BASIS: Record<string, string> = { median_alert_to_pick_up: "median, alert to picked up", median: "median" };

/** Today’s tiles: label, icon, colour and the line under the number. */
const TODAY_KPI: Record<string, { label: string; icon: string; tone: Tone; sub: (k: OverviewKpi) => string }> = {
  alerts_today: { label: "Alerts today", icon: "app/icon-alert-triangle-secondary-18", tone: "high", sub: (k) => `${count(k, "open") ?? 0} open · ${count(k, "critical") ?? 0} critical` },
  money_protected: { label: "Money protected", icon: "app/icon-shield-secondary-18", tone: "success", sub: () => "frozen or recovered today" },
  confirmed_fraud: { label: "Confirmed fraud", icon: "app/icon-folder-secondary-16", tone: "critical", sub: () => "cases closed as fraud" },
  response_time: { label: "Response time", icon: "app/icon-timer-secondary-18", tone: "neutral", sub: (k) => BASIS[k.basis ?? ""] ?? "median, alert to picked up" },
};

const arrow = (n: number) => (n > 0 ? "▲" : "▼");

/** The week or month tiles. `vs` names the period the change is against. */
const PERIOD_KPI: Record<string, { label: string; icon: string; line: (k: OverviewKpi, vs: string) => { sub: string; tone: Tone } }> = {
  cases_closed: {
    label: "Cases closed",
    icon: "app/icon-check-circle-secondary-18",
    line: (k, vs) => (k.change ? { sub: `${arrow(k.change)} ${Math.abs(k.change)} vs ${vs}`, tone: k.change > 0 ? "success" : "medium" } : { sub: `Same as ${vs}`, tone: "neutral" }),
  },
  time_to_close: {
    label: "Median time to close",
    icon: "app/icon-timer-secondary-18",
    line: (k, vs) => (k.change ? { sub: `${arrow(k.change)} ${Math.abs(k.change)} min · ${k.change < 0 ? "faster" : "slower"}`, tone: k.change < 0 ? "success" : "medium" } : { sub: `Same as ${vs}`, tone: "neutral" }),
  },
  false_positive_rate: {
    label: "False-positive rate",
    icon: "app/icon-filter-18",
    line: (k, vs) => {
      const noisy = k.noisiest_rule ? ` · ${k.noisiest_rule} noisy` : "";
      return k.change ? { sub: `${arrow(k.change)} ${Math.abs(k.change)} pts${noisy}`, tone: k.change > 0 ? "medium" : "success" } : { sub: `Same as ${vs}${noisy}`, tone: "neutral" };
    },
  },
  recovered: {
    label: "Recovered",
    icon: "app/icon-wallet-18",
    line: (k) => ({ sub: `of ${showMoney(money(k, "lost"))} lost${k.value !== null ? ` · ${k.value}%` : ""}`, tone: "neutral" }),
  },
};

/** Wed · Thu · … · Today, from `2026-10-14`. */
function dayLabel(date: string, now: number) {
  if (date === new Date(now).toLocaleDateString("en-CA", { timeZone: TZ })) return "Today";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
}

/** The app’s copy for a widget that failed on its own. */
const WIDGET_ERROR: Record<string, string> = {
  upstream_timeout: "The location service timed out. Other widgets are fine.",
};

function Spark({ values, tone }: { values: number[]; tone: Tone }) {
  const max = Math.max(...values, 1);
  return (
    <span aria-hidden className="flex h-[38px] items-end gap-[3px]">
      {values.map((v, i) => (
        <span key={i} className={cn("w-[5px] rounded-t-[1.5px]", i === values.length - 1 ? BAR[tone] : "bg-brand-highlight/45")} style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border-subtle bg-surface-base px-4 py-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

function Lines({ n = 3 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="flex flex-col gap-2">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          {i < n - 1 && <Skeleton className="h-3 w-1/2" />}
        </span>
      ))}
    </div>
  );
}

/** H1–H5 · Overview — today, live; or the week for me, my team or the whole operator. */
export default function OverviewPage() {
  const params = useSearchParams();
  const now = useNow(5000);
  const { mutate } = useSWRConfig();
  const [period, setPeriod] = useState<"today" | "7d" | "30d">(params.get("period") === "7d" ? "7d" : "today");
  const [scope, setScope] = useState<"me" | "team" | "operator">("me");
  const q = new URLSearchParams({ period, scope: period === "today" ? "operator" : scope });
  if (params.get("demo")) q.set("demo", params.get("demo")!);
  const key = `/insights/overview?${q}`;
  const { data } = useApi<Overview>(key, { refreshInterval: period === "today" ? 15_000 : 300_000 });
  const { data: sla } = useApi<Sla>(period === "today" ? null : `/insights/sla?period=${period}`);
  const today: Today | null = data?.period === "today" ? data : null;
  const week: Week | null = data && data.period !== "today" ? data : null;
  const vs = period === "7d" ? "last week" : "the 30 days before";
  const ago = today ? Math.max(1, Math.round((now - Date.parse(today.updated_at)) / 1000)) : null;

  const exportCsv = () => {
    if (!data) return;
    const rows = data.kpis.map((k) => [
      (today ? TODAY_KPI : PERIOD_KPI)[k.key]?.label ?? k.key,
      k.unit === "money" ? (k.money ? k.money.amount_minor / 100 : "") : (k.value ?? ""),
      k.unit === "money" ? (k.money?.currency ?? "") : k.unit,
    ]);
    const url = URL.createObjectURL(new Blob([["metric,value,unit", ...rows.map((r) => r.join(","))].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `overview-${period}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AppHeader section="Insights" title="Overview" />
      <PageBody>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2.5 text-h1 text-text-primary">
              Overview
              {period === "today" && <Badge label="Live" tone="success" dot />}
            </h2>
            <p className="text-body-s text-text-secondary">
              {!data
                ? "Kasa Mobile · loading…"
                : today
                  ? `Live · all of Kasa Mobile · updated ${ago} s ago`
                  : `${scope === "me" ? "Your" : scope === "team" ? "Your team’s" : "Kasa Mobile’s"} ${period === "7d" ? "week" : "month"} so far · updates every 5 minutes.`}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {period !== "today" && (
              <Segmented
                label="Whose numbers"
                value={scope}
                onChange={setScope}
                options={[
                  { id: "me", label: "Me" },
                  { id: "team", label: "My team" },
                  { id: "operator", label: "Kasa Mobile" },
                ]}
              />
            )}
            <Segmented
              label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { id: "today", label: "Today · live" },
                { id: "7d", label: "This week" },
                { id: "30d", label: "Last 30 days" },
              ]}
            />
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!data} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {!data
            ? Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)
            : today
              ? today.kpis.map((k) => {
                  const c = TODAY_KPI[k.key] ?? { label: k.key, icon: "app/icon-chart-secondary-18", tone: "neutral" as const, sub: () => "" };
                  return (
                    <div key={k.key} className="flex items-end justify-between gap-3 rounded-xl border border-border-subtle bg-surface-base px-4 py-4">
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 text-caption text-text-secondary">
                          <Icon name={c.icon} size={14} />
                          {c.label}
                        </span>
                        <span className={cn("text-h1", TEXT[c.tone])}>{kpiValue(k)}</span>
                        <span className="text-caption text-text-secondary">{c.sub(k)}</span>
                      </span>
                      {k.spark && <Spark values={k.spark} tone={c.tone} />}
                    </div>
                  );
                })
              : week!.kpis.map((k) => {
                  const c = PERIOD_KPI[k.key];
                  const { sub, tone } = c?.line(k, vs) ?? { sub: "", tone: "neutral" as const };
                  return (
                    <div key={k.key} className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-base px-5 py-4">
                      <span className="flex items-center justify-between text-caption text-text-secondary">
                        {c?.label ?? k.key}
                        <Icon name={c?.icon ?? "app/icon-chart-secondary-18"} size={16} />
                      </span>
                      <span className="text-h1 text-text-primary">{kpiValue(k)}</span>
                      <span className={cn("text-caption", tone === "neutral" ? "text-text-secondary" : TEXT[tone])}>{sub}</span>
                    </div>
                  );
                })}
        </div>

        {period === "today" ? (
          <div className="grid grid-cols-2 items-start gap-4">
            <Card
              title="Right now"
              icon="app/icon-activity-secondary-18"
              aside={
                <Link href="/alerts" className="flex items-center gap-1.5 rounded text-label-s text-text-brand hover:underline">
                  <Icon name="app/icon-arrow-right-brand-16" size={14} />
                  All {today?.open_alerts ?? 23} open
                </Link>
              }
            >
              {!today ? (
                <Lines />
              ) : (
                <ul className="flex flex-col">
                  {today.right_now.map((a) => (
                    <li key={a.id}>
                      <Link href={`/alerts?open=${a.id}`} className="flex items-center gap-3 rounded-lg py-3 hover:bg-surface-raised">
                        <span className={cn("h-9 w-[3px] shrink-0 rounded-full", BAR[riskTone(a.risk_score)])} />
                        <span className="font-mono text-mono-s text-text-tertiary">{formatClock(a.created_at)}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-label-m text-text-primary">{a.title}</span>
                          <span className="truncate text-caption text-text-secondary">
                            {a.region} · {a.subscriber.msisdn}
                          </span>
                        </span>
                        <span className="font-mono text-mono-m text-text-primary">{showMoney(a.money_out)}</span>
                        <Badge label={String(a.risk_score)} tone={riskTone(a.risk_score)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="flex flex-col gap-4">
              <Card title="What kind of fraud today" icon="app/icon-chart-secondary-18">
                {!today ? (
                  <Lines />
                ) : (
                  <>
                    <div className="flex h-4 gap-1" role="img" aria-label="Fraud mix">
                      {today.fraud_mix.map((m, i) => (
                        <span key={m.fraud_type} className={cn("h-4 rounded-[3px]", MIX[i])} style={{ width: `${m.share_pct}%` }} />
                      ))}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {today.fraud_mix.map((m, i) => (
                        <li key={m.fraud_type} className="flex items-center gap-2 text-caption text-text-secondary">
                          <span className={cn("size-2 rounded-[2px]", MIX[i])} />
                          {fraudTypeLabel(m.fraud_type)}
                          <span className="font-mono text-mono-s text-text-primary">{m.share_pct}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
              <Card
                title="Hotspots"
                icon="app/icon-map-pin-secondary-18"
                aside={
                  <Link href="/heatmap" className="flex items-center gap-1.5 rounded text-label-s text-text-brand hover:underline">
                    <Icon name="app/icon-map-brand-16" size={14} />
                    Open heatmap
                  </Link>
                }
              >
                {!today ? (
                  <Lines />
                ) : today.widget_errors.hotspots ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <span className="flex size-9 items-center justify-center rounded-[10px] bg-critical-bg">
                      <Icon name="icon-alert-circle-critical-20" size={18} />
                    </span>
                    <p className="text-label-m text-text-primary">Couldn’t load hotspots</p>
                    <p className="text-caption text-text-secondary">{WIDGET_ERROR[today.widget_errors.hotspots.code] ?? "Something went wrong. Other widgets are fine."}</p>
                    <Button variant="secondary" size="sm" onClick={() => mutate(key.replace(/&?demo=[^&]*/, ""))} iconLeft={<Icon name="app/icon-refresh-16" size={14} />}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {today.hotspots?.map((h, i) => (
                      <li key={h.area} className="flex items-center gap-4 text-body-s text-text-primary">
                        <span className="w-[84px]">{h.area}</span>
                        <span className="h-1.5 max-w-[240px] flex-1 rounded-full bg-surface-sunken">
                          <span className={cn("block h-1.5 rounded-full", i === 0 ? "bg-critical-fg" : i < 3 ? "bg-high-fg" : "bg-brand-highlight")} style={{ width: `${(h.alerts / today.hotspots![0].alerts) * 100}%` }} />
                        </span>
                        <span className="font-mono text-mono-s text-text-secondary">{h.alerts} alerts</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <Card
                title="Alerts vs cases"
                icon="app/icon-chart-secondary-18"
                className="min-w-0 flex-1"
                aside={
                  <span className="flex items-center gap-3 text-caption text-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px] bg-brand-primary-subtle" />
                      Alerts triaged
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px] bg-brand-primary" />
                      Cases opened
                    </span>
                  </span>
                }
              >
                {!week ? (
                  <Skeleton className="h-[180px] w-full" />
                ) : (
                  <div className="flex h-[190px] items-end gap-6 px-2" role="img" aria-label="Alerts triaged and cases opened per day">
                    {week.daily.map((d) => {
                      const max = Math.max(...week.daily.map((x) => x.alerts));
                      return (
                        <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-2">
                          <div className="flex w-full flex-1 items-end justify-center gap-1.5">
                            <span title={`${d.alerts} alerts`} className="w-5 rounded-t-[3px] bg-brand-primary-subtle" style={{ height: `${(d.alerts / max) * 100}%` }} />
                            <span title={`${d.cases} cases`} className="w-5 rounded-t-[3px] bg-brand-primary" style={{ height: `${(d.cases / max) * 100}%` }} />
                          </div>
                          <span className="text-caption text-text-secondary">{dayLabel(d.date, now)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
              <Card title="Fraud mix · confirmed" icon="app/icon-zap-secondary-18" className="w-[460px] shrink-0">
                {!week ? (
                  <Lines />
                ) : (
                  <ul className="flex flex-col gap-3">
                    {week.fraud_mix.map((m, i) => (
                      <li key={m.fraud_type} className="flex flex-col gap-1">
                        <span className="flex justify-between text-caption text-text-primary">
                          {fraudTypeLabel(m.fraud_type)}
                          <span className="text-text-secondary">{m.share_pct}%</span>
                        </span>
                        <span className="h-1.5 rounded-full bg-surface-sunken">
                          <span className={cn("block h-1.5 rounded-full", MIX[i])} style={{ width: `${(m.share_pct / week.fraud_mix[0].share_pct) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <div className="flex items-start gap-4">
              <Card title="Rules that fired on your alerts" icon="app/icon-sliders-18" className="min-w-0 flex-1">
                {!week ? (
                  <Lines />
                ) : (
                  <div className="overflow-hidden rounded-[10px] border border-border-subtle">
                    <table className="w-full text-left">
                      <thead className="bg-surface-raised">
                        <tr className="text-overline text-text-tertiary uppercase">
                          <th className="w-[90px] py-2.5 pl-3.5 font-bold">Rule</th>
                          <th className="py-2.5 font-bold">What it catches</th>
                          <th className="w-[70px] py-2.5 text-right font-bold">Hits</th>
                          <th className="w-[110px] py-2.5 pl-4 font-bold">Precision</th>
                          <th className="w-[200px] py-2.5 pr-3.5 font-bold">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {week.rules.map((r) => (
                          <tr key={r.id} className="border-t border-border-subtle">
                            <td className="py-3 pl-3.5 font-mono text-mono-s text-text-brand">{r.id}</td>
                            <td className="py-3 text-body-s text-text-primary">{r.name}</td>
                            <td className="py-3 text-right font-mono text-mono-s text-text-primary">{r.hits}</td>
                            <td className="py-3 pl-4">
                              <Badge label={`${r.precision_pct}%`} tone={r.precision_pct >= 85 ? "success" : r.precision_pct >= 50 ? "medium" : "critical"} />
                            </td>
                            <td className={cn("py-3 pr-3.5 text-caption", r.your_fp_feedback ? "text-critical-fg" : "text-text-tertiary")}>
                              {r.your_fp_feedback ? `${r.your_fp_feedback} of your FP feedback` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              <Card title={`My SLAs · ${period === "7d" ? "this week" : "last 30 days"}`} icon="app/icon-timer-secondary-18" className="w-[460px] shrink-0">
                {!sla ? (
                  <Lines />
                ) : (
                  <ul className="flex flex-col">
                    {[
                      ["First response < 15 min", `${sla.first_response.met} of ${sla.first_response.total}`, `${sla.first_response_within_sla_pct}%`, "text-success-fg"],
                      ["Critical cases closed < 4h", `${sla.critical_closed.met} of ${sla.critical_closed.total}`, `${sla.critical_closed_within_4h_pct}%`, "text-success-fg"],
                      ["Sent back by supervisor", sla.sent_back_case_ids.join(", "), String(sla.sent_back), "text-medium-fg"],
                    ].map(([label, sub, value, tone]) => (
                      <li key={label} className="flex items-center justify-between border-b border-border-subtle py-3.5 last:border-b-0">
                        <span className="flex flex-col">
                          <span className="text-body-s text-text-primary">{label}</span>
                          <span className="text-caption text-text-tertiary">{sub}</span>
                        </span>
                        <span className={cn("text-h3", tone)}>{value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
