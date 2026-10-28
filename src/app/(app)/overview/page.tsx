"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Card, CardLink } from "@/components/app/Card";
import { riskTone } from "@/components/app/indicators";
import { CardSkeleton, ChartCard, ColumnChart, DetailRows, LabelledBars, LegendItem, SegmentChips, StatTile, StatTileSkeleton, WidgetError } from "@/components/reports/Insights";
import { DataTable, Td, Th, THead, Tr } from "@/components/reports/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fraudTypeLabel, useApi, type Money, type Overview, type OverviewKpi } from "@/lib/api/fd";
import { formatClock, formatMoney, formatSpan, TZ, useNow } from "@/lib/time";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";

type Period = "today" | "7d" | "30d";
type Scope = "me" | "team" | "operator";
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

const BASIS: Record<string, string> = { median_alert_to_pick_up: "Median, alert to picked up", median: "Median" };

/** H1 · Today’s tiles: label and the line under the number (words, no colour). */
const TODAY_KPI: Record<string, { label: string; delta: (k: OverviewKpi) => string }> = {
  alerts_today: { label: "Alerts today", delta: (k) => `${count(k, "open") ?? 0} open · ${count(k, "critical") ?? 0} critical` },
  money_protected: { label: "Money protected", delta: () => "Frozen or recovered today" },
  confirmed_fraud: { label: "Confirmed fraud", delta: () => "Cases closed as fraud" },
  response_time: { label: "Response time", delta: (k) => BASIS[k.basis ?? ""] ?? "Median, alert to picked up" },
};

/** H4 · Week or month tiles. `vs` names the period the change is against. */
const PERIOD_KPI: Record<string, { label: string; delta: (k: OverviewKpi, vs: string) => string }> = {
  cases_closed: {
    label: "Cases closed",
    delta: (k, vs) => (k.change ? `${Math.abs(k.change)} ${k.change > 0 ? "more" : "fewer"} than ${vs}` : `Same as ${vs}`),
  },
  time_to_close: {
    label: "Median time to close",
    delta: (k, vs) => (k.change ? `${Math.abs(k.change)} min ${k.change < 0 ? "faster" : "slower"}` : `Same as ${vs}`),
  },
  false_positive_rate: {
    label: "False-positive rate",
    delta: (k, vs) => {
      const noisy = k.noisiest_rule ? ` · ${k.noisiest_rule} is noisy` : "";
      return k.change ? `${k.change > 0 ? "Up" : "Down"} ${Math.abs(k.change)} points${noisy}` : `Same as ${vs}${noisy}`;
    },
  },
  recovered: {
    label: "Recovered",
    delta: (k) => `${k.value !== null ? `${k.value}% of ` : ""}${showMoney(money(k, "lost"))} lost`,
  },
};

/** Thu 22 · … · Today, from `2026-10-22`. */
function dayLabel(date: string, now: number) {
  if (date === new Date(now).toLocaleDateString("en-CA", { timeZone: TZ })) return "Today";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: TZ });
}

/** Thu 22 Oct, from `2026-10-22`. */
const longDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });

/** The app’s copy for a widget that failed on its own. */
const WIDGET_ERROR: Record<string, string> = {
  upstream_timeout: "The location service timed out. Other widgets are fine.",
};
const widgetErrorCopy = (code: string) => WIDGET_ERROR[code] ?? "Something went wrong. Other widgets are fine.";

const RISK: Record<ReturnType<typeof riskTone>, { label: string; tone: BadgeTone }> = {
  critical: { label: "Critical", tone: "critical" },
  high: { label: "High", tone: "high" },
  medium: { label: "Medium", tone: "medium" },
  low: { label: "Low", tone: "neutral" },
};

/** Risk pill — “97 Critical”. */
function RiskPill({ score }: { score: number }) {
  const r = RISK[riskTone(score)];
  return <Badge label={`${score} ${r.label}`} tone={r.tone} />;
}

const precisionTone = (pct: number): BadgeTone => (pct >= 85 ? "success" : pct >= 50 ? "medium" : "critical");

const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: "me", label: "Me" },
  { id: "team", label: "My team" },
  { id: "operator", label: "Kasa Mobile" },
];
const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today · live" },
  { id: "7d", label: "This week" },
  { id: "30d", label: "Last 30 days" },
];

/** Page subtitle: whose numbers, then live/loading state. */
function subtitle(period: Period, scope: Scope, state: ReactNode) {
  if (period === "today") return `${scope === "operator" ? "All of Kasa Mobile" : scope === "team" ? "Your team" : "Just you"} · ${state}`;
  const who = scope === "me" ? "Your" : scope === "team" ? "Your team’s" : "Kasa Mobile’s";
  return `${who} ${period === "7d" ? "week so far" : "last 30 days"} · ${state}`;
}

/** H1–H5 · Overview — today, live; or the week / 30 days for me, my team or the whole operator. */
export default function OverviewPage() {
  const params = useSearchParams();
  const now = useNow(5000);
  const { mutate } = useSWRConfig();
  const [period, setPeriod] = useState<Period>(params.get("period") === "7d" ? "7d" : "today");
  const [scope, setScope] = useState<Scope>(period === "today" ? "operator" : "me");
  const q = new URLSearchParams({ period, scope });
  if (params.get("demo")) q.set("demo", params.get("demo")!);
  const key = `/insights/overview?${q}`;
  const { data } = useApi<Overview>(key, { refreshInterval: period === "today" ? 15_000 : 300_000 });
  const { data: sla } = useApi<Sla>(period === "today" ? null : `/insights/sla?period=${period}`);
  const today: Today | null = data?.period === "today" ? data : null;
  const week: Week | null = data && data.period !== "today" ? data : null;
  const vs = period === "7d" ? "last week" : "the 30 days before";
  const span = period === "7d" ? "this week" : "last 30 days";
  const ago = today ? Math.max(1, Math.round((now - Date.parse(today.updated_at)) / 1000)) : null;
  const retry = () => mutate(key.replace(/&?demo=[^&]*/, ""));

  /** Today is everyone’s live view; the week opens on your own numbers. */
  const changePeriod = (p: Period) => {
    setPeriod(p);
    if ((p === "today") !== (period === "today")) setScope(p === "today" ? "operator" : "me");
  };

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
      <PageBody className="flex flex-1 flex-col gap-4 px-8 pt-6 pb-8">
        {/* Page header with the Live pill — PageHead takes a plain string title, so its markup is mirrored here. */}
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="flex items-center gap-2 text-h2 text-text-primary">
              Overview
              {period === "today" && <Badge label="Live" tone="success" size="md" />}
            </h2>
            <p className="text-body-s text-text-secondary">{subtitle(period, scope, !data ? "loading" : today ? `updated ${ago} s ago` : "updates every 5 minutes")}</p>
          </div>
          <Button variant="secondary" size="md" onClick={exportCsv} disabled={!data}>
            Export
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <SegmentChips label="Whose numbers" value={scope} onChange={setScope} options={SCOPES} />
          <SegmentChips label="Period" value={period} onChange={changePeriod} options={PERIODS} />
        </div>

        <div className="flex gap-3">
          {!data
            ? Array.from({ length: 4 }, (_, i) => <StatTileSkeleton key={i} />)
            : today
              ? today.kpis.map((k) => {
                  const c = TODAY_KPI[k.key];
                  return <StatTile key={k.key} label={c?.label ?? k.key} value={kpiValue(k)} delta={c?.delta(k)} />;
                })
              : week!.kpis.map((k) => {
                  const c = PERIOD_KPI[k.key];
                  return <StatTile key={k.key} label={c?.label ?? k.key} value={kpiValue(k)} delta={c?.delta(k, vs)} />;
                })}
        </div>

        {period === "today" ? (
          <div className="flex items-start gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {!today ? (
                <CardSkeleton />
              ) : (
                <Card title="Right now" aside={<CardLink href="/alerts">All {today.open_alerts} open</CardLink>}>
                  {today.widget_errors.right_now ? (
                    <WidgetError title="Couldn’t load the latest alerts" onRetry={retry}>
                      {widgetErrorCopy(today.widget_errors.right_now.code)}
                    </WidgetError>
                  ) : (
                    <ul className="-mt-1 flex flex-col">
                      {today.right_now.map((a) => (
                        <li key={a.id} className="border-b border-border-default last:border-b-0">
                          <Link href={`/alerts?open=${a.id}`} className="flex h-[52px] items-center gap-3 rounded hover:bg-surface-sunken">
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-label-s text-text-primary">{a.title}</span>
                              <span className="truncate text-caption text-text-secondary">
                                {formatClock(a.created_at)} · {a.region}
                                {a.subscriber.msisdn ? ` · ${a.subscriber.msisdn}` : ""}
                              </span>
                            </span>
                            <span className="text-body-s whitespace-nowrap text-text-secondary">{showMoney(a.money_out)}</span>
                            <RiskPill score={a.risk_score} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
            </div>
            <div className="flex w-[480px] shrink-0 flex-col gap-6">
              {!today ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : (
                <>
                  <Card title="What kind of fraud today">
                    {today.widget_errors.fraud_mix ? (
                      <WidgetError title="Couldn’t load the fraud mix" onRetry={retry}>
                        {widgetErrorCopy(today.widget_errors.fraud_mix.code)}
                      </WidgetError>
                    ) : (
                      <LabelledBars
                        label="Share of today’s alerts by fraud type"
                        items={today.fraud_mix.map((m) => ({ key: m.fraud_type, label: fraudTypeLabel(m.fraud_type), value: m.share_pct, display: `${m.share_pct}%` }))}
                      />
                    )}
                  </Card>
                  <Card title="Hotspots" aside={<CardLink href="/heatmap">Open heatmap</CardLink>}>
                    {today.widget_errors.hotspots || !today.hotspots ? (
                      <WidgetError title="Couldn’t load hotspots" onRetry={retry}>
                        {widgetErrorCopy(today.widget_errors.hotspots?.code ?? "")}
                      </WidgetError>
                    ) : (
                      <LabelledBars label="Alerts by area" items={today.hotspots.map((h) => ({ key: h.area, label: h.area, value: h.alerts, display: `${h.alerts} alerts` }))} />
                    )}
                  </Card>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {!week ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : (
                <>
                  <ChartCard
                    title={`Alerts triaged · ${span}`}
                    meta={week.daily.length ? `${longDay(week.daily[0].date)} to today · ${week.daily.reduce((n, d) => n + d.alerts, 0)} in total` : undefined}
                    legend={<LegendItem swatch="bg-chart-1">Alerts triaged</LegendItem>}
                  >
                    {week.daily.length ? (
                      <ColumnChart unit="alerts" label={`Alerts triaged per day, ${span}`} data={week.daily.map((d) => ({ key: d.date, label: dayLabel(d.date, now), value: d.alerts }))} />
                    ) : (
                      <p className="flex h-60 items-center justify-center text-body-s text-text-secondary">No alerts triaged {span} yet. Try the last 30 days.</p>
                    )}
                  </ChartCard>
                  <Card title="Rules that fired on your alerts">
                    <DataTable>
                      <THead>
                        <Th className="w-[90px]">Rule</Th>
                        <Th>What it catches</Th>
                        <Th align="right" className="w-20">
                          Hits
                        </Th>
                        <Th className="w-[110px]">Precision</Th>
                        <Th className="w-[230px]">Note</Th>
                      </THead>
                      <tbody>
                        {week.rules.map((r) => (
                          <Tr key={r.id}>
                            <Td>{r.id}</Td>
                            <Td>{r.name}</Td>
                            <Td align="right">{r.hits}</Td>
                            <Td>
                              <Badge label={`${r.precision_pct}%`} tone={precisionTone(r.precision_pct)} />
                            </Td>
                            <Td>{r.your_fp_feedback ? `${r.your_fp_feedback} of your false-positive notes` : "–"}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </Card>
                </>
              )}
            </div>
            <div className="flex w-[400px] shrink-0 flex-col gap-6">
              {!week ? (
                <CardSkeleton />
              ) : (
                <Card title="Fraud mix · confirmed">
                  <LabelledBars
                    label="Confirmed fraud by type"
                    items={week.fraud_mix.map((m) => ({ key: m.fraud_type, label: fraudTypeLabel(m.fraud_type), value: m.share_pct, display: `${m.share_pct}%` }))}
                  />
                </Card>
              )}
              {!sla ? (
                <CardSkeleton />
              ) : (
                <Card title={`My SLAs · ${span}`}>
                  <DetailRows
                    rows={[
                      ["First response under 15 min", `${sla.first_response_within_sla_pct}% · ${sla.first_response.met} of ${sla.first_response.total}`],
                      ["Critical cases closed under 4 h", `${sla.critical_closed_within_4h_pct}% · ${sla.critical_closed.met} of ${sla.critical_closed.total}`],
                      ["Sent back by supervisor", sla.sent_back ? `${sla.sent_back} · ${sla.sent_back_case_ids.join(", ")}` : "0"],
                    ]}
                  />
                </Card>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
