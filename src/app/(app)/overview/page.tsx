"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Card, Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney, useNow } from "@/lib/time";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Tone = "critical" | "high" | "medium" | "success" | "neutral";
type TodayKpi = { key: string; label: string; value: number; unit: string; sub: string; tone: Tone; spark: number[] };
type Today = {
  period: "today";
  updated_at: string;
  kpis: TodayKpi[];
  right_now: Array<{ id: string; at: string; title: string; where: string; money: number | null; risk: number }>;
  open_alerts: number;
  fraud_mix: Array<{ fraud_type: string; label: string; share_pct: number }>;
  hotspots: Array<{ area: string; alerts: number }> | null;
  widget_errors?: Record<string, { title: string; detail: string }>;
};
type Week = {
  period: string;
  kpis: Array<{ key: string; label: string; value: string; sub: string; tone: Tone; icon: string }>;
  daily: Array<{ day: string; alerts: number; cases: number }>;
  fraud_mix: Array<{ fraud_type: string; label: string; share_pct: number }>;
  rules: Array<{ id: string; catches: string; hits: number; precision: number; note: string | null }>;
};
type Sla = { first_response_within_sla_pct: number; first_response_detail: string; critical_closed_within_4h_pct: number; critical_closed_detail: string; sent_back: number; sent_back_cases: string[] };

const KPI_ICON: Record<string, string> = {
  alerts_today: "app/icon-alert-triangle-secondary-18",
  money_protected: "app/icon-shield-secondary-18",
  confirmed_fraud: "app/icon-folder-secondary-16",
  response_time: "app/icon-timer-secondary-18",
  check: "app/icon-check-circle-secondary-18",
  timer: "app/icon-timer-secondary-18",
  filter: "app/icon-filter-18",
  wallet: "app/icon-wallet-18",
};
const TEXT: Record<Tone, string> = { critical: "text-critical-fg", high: "text-high-fg", medium: "text-medium-fg", success: "text-success-fg", neutral: "text-text-primary" };
const BAR: Record<Tone, string> = { critical: "bg-critical-fg", high: "bg-high-fg", medium: "bg-medium-fg", success: "bg-success-fg", neutral: "bg-brand-primary" };
const MIX = ["bg-critical-fg", "bg-high-fg", "bg-medium-fg", "bg-brand-primary", "bg-border-strong"];
const riskTone = (r: number): Tone => (r >= 90 ? "critical" : r >= 70 ? "high" : "medium");

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
  const [scope, setScope] = useState<"me" | "team" | "org">("me");
  const q = new URLSearchParams({ period, scope: period === "today" ? "org" : scope });
  if (params.get("demo")) q.set("demo", params.get("demo")!);
  const key = `/insights/overview?${q}`;
  const { data } = useApi<Today | Week>(key, { refreshInterval: period === "today" ? 15_000 : 300_000 });
  const { data: sla } = useApi<Sla>(period === "today" ? null : "/insights/sla?period=7d");
  const today = data?.period === "today" ? (data as Today) : null;
  const week = data && data.period !== "today" ? (data as Week) : null;
  const ago = today ? Math.max(1, Math.round((now - Date.parse(today.updated_at)) / 1000)) : null;

  const exportCsv = () => {
    if (!data) return;
    const rows = today ? today.kpis.map((k) => [k.label, k.value, k.unit]) : week!.kpis.map((k) => [k.label, k.value, ""]);
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
                  { id: "org", label: "Kasa Mobile" },
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
              ? today.kpis.map((k) => (
                  <div key={k.key} className="flex items-end justify-between gap-3 rounded-xl border border-border-subtle bg-surface-base px-4 py-4">
                    <span className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 text-caption text-text-secondary">
                        <Icon name={KPI_ICON[k.key]} size={14} />
                        {k.label}
                      </span>
                      <span className={cn("text-h1", TEXT[k.tone])}>{k.unit === "GHS" ? formatMoney(k.value * 100, "GHS") : k.unit === "min" ? `${k.value} min` : k.value}</span>
                      <span className="text-caption text-text-secondary">{k.sub}</span>
                    </span>
                    <Spark values={k.spark} tone={k.tone} />
                  </div>
                ))
              : week!.kpis.map((k) => (
                  <div key={k.key} className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-base px-5 py-4">
                    <span className="flex items-center justify-between text-caption text-text-secondary">
                      {k.label}
                      <Icon name={KPI_ICON[k.icon]} size={16} />
                    </span>
                    <span className="text-h1 text-text-primary">{k.value}</span>
                    <span className={cn("text-caption", k.tone === "neutral" ? "text-text-secondary" : TEXT[k.tone])}>{k.sub}</span>
                  </div>
                ))}
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
                        <span className={cn("h-9 w-[3px] shrink-0 rounded-full", BAR[riskTone(a.risk)])} />
                        <span className="font-mono text-mono-s text-text-tertiary">{formatClock(a.at)}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-label-m text-text-primary">{a.title}</span>
                          <span className="truncate text-caption text-text-secondary">{a.where}</span>
                        </span>
                        <span className="font-mono text-mono-m text-text-primary">{a.money ? formatMoney(a.money * 100, "GHS") : "–"}</span>
                        <Badge label={String(a.risk)} tone={riskTone(a.risk) as "critical"} />
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
                          {m.label}
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
                ) : today.widget_errors?.hotspots ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <span className="flex size-9 items-center justify-center rounded-[10px] bg-critical-bg">
                      <Icon name="icon-alert-circle-critical-20" size={18} />
                    </span>
                    <p className="text-label-m text-text-primary">{today.widget_errors.hotspots.title}</p>
                    <p className="text-caption text-text-secondary">{today.widget_errors.hotspots.detail}</p>
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
                        <div key={d.day} className="flex h-full flex-1 flex-col items-center gap-2">
                          <div className="flex w-full flex-1 items-end justify-center gap-1.5">
                            <span title={`${d.alerts} alerts`} className="w-5 rounded-t-[3px] bg-brand-primary-subtle" style={{ height: `${(d.alerts / max) * 100}%` }} />
                            <span title={`${d.cases} cases`} className="w-5 rounded-t-[3px] bg-brand-primary" style={{ height: `${(d.cases / max) * 100}%` }} />
                          </div>
                          <span className="text-caption text-text-secondary">{d.day}</span>
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
                          {m.label}
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
                            <td className="py-3 text-body-s text-text-primary">{r.catches}</td>
                            <td className="py-3 text-right font-mono text-mono-s text-text-primary">{r.hits}</td>
                            <td className="py-3 pl-4">
                              <Badge label={`${r.precision}%`} tone={r.precision >= 85 ? "success" : r.precision >= 50 ? "medium" : "critical"} />
                            </td>
                            <td className={cn("py-3 pr-3.5 text-caption", r.note ? "text-critical-fg" : "text-text-tertiary")}>{r.note ?? "—"}</td>
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
                      ["First response < 15 min", sla.first_response_detail, `${sla.first_response_within_sla_pct}%`, "text-success-fg"],
                      ["Critical cases closed < 4h", sla.critical_closed_detail, `${sla.critical_closed_within_4h_pct}%`, "text-success-fg"],
                      ["Sent back by supervisor", sla.sent_back_cases.join(", "), String(sla.sent_back), "text-medium-fg"],
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
