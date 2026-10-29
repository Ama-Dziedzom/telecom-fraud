"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, CardLink, CardMeta, Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { riskTone } from "@/components/app/indicators";
import { localMsisdn } from "@/components/cases/CaseTable";
import { BarDivider, SegmentChips, ToolbarSearch, ToolbarSelect } from "@/components/cases/Table";
import { HeatMap } from "@/components/heatmap/HeatMap";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, useApi, type Money, type SubscriberRef } from "@/lib/api/fd";
import { useOperatorName } from "@/lib/auth/session";
import { formatClock, formatMoney } from "@/lib/time";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Area = { id: string; name: string };
type Town = { id: string; name: string; parent: string; top_fraud_type?: string; agents?: number; alerts: number; change: number };
type Region = { id: string; name: string; top_towns: string[]; alerts: number; change: number };
type HeatAgent = { code: string; area: string; swaps_today: number; swaps_became_fraud: number; alerts: number; change: number; hot: boolean };
/** GET /heatmap. Country and region views send `confirmed_fraud` and `new_since`; a district sends `money_out` and `agents_in_view`. */
type Heat = {
  area: Area & { level: "country" | "region" | "district"; path: Area[] };
  metric: string;
  period: string;
  filters?: { fraud_type?: string; region?: string };
  kpis: {
    alerts: { value: number; change_pct: number | null };
    hottest_area: { area_id: string; name: string; alerts: number; agents: number } | null;
    confirmed_fraud?: { money: Money; cases_closed: number };
    new_since?: { since: string; value: number; top_area_id: string | null };
    money_out?: { money: Money; wallets: number };
    agents_in_view?: { value: number; with_fraud: number };
  };
  shapes: Array<{ id: string; intensity: number }>;
  towns: Town[];
  regions: Region[];
  agents: HeatAgent[];
  /** Nothing matches the filters: where to look instead. */
  empty: { focus_area_id: string; last_7d: number; last_7d_area_ids: string[] } | null;
  updated_at: string;
  refresh_seconds: number;
};
/** GET /heatmap/layers: what the map draws. It can fail on its own (504 upstream_timeout) while the numbers stay live. */
type MapLayers = { area: string; period: string; shapes: Array<{ id: string; intensity: number }>; pins: Array<{ id: string; alerts: number }> };
type AreaDetail = {
  id: string;
  name: string;
  path: Area[];
  period: string;
  /** Engine text. */
  summary: string;
  alerts: number;
  usual_alerts: number;
  agents: number;
  moved_out: Money;
  drivers: Array<{ fraud_type: string; alerts: number }>;
  agent_list: Array<{ code: string; street: string; swaps_today: number; swaps_became_fraud: number }>;
  untriaged: { total: number; data: Array<{ id: string; risk_score: number; fraud_type: string; subscriber: SubscriberRef }> };
};
type Kpi = { label: string; value: string; sub: string; icon: string; tone?: "critical" | "medium" };
type Row = { id: string; name: string; parent?: string; sub: string; value: number; change: number | null };

const LEVEL: Record<string, "country" | "ashanti" | "kumasi"> = { ghana: "country", ashanti: "ashanti", kumasi: "kumasi" };
const FRAUD_TYPES: ReadonlyArray<readonly [string, string]> = [
  ["", "All fraud types"],
  ...["sim_swap_to_momo", "account_takeover", "agent_cash_out"].map((t) => [t, fraudTypeLabel(t)] as const),
];
const METRIC: Record<string, string> = { alerts: "Alerts", confirmed: "Confirmed fraud", ghs_lost: "GHS lost" };
const REGIONS = [
  ["", "All regions"],
  ["ashanti", "Ashanti"],
  ["greater-accra", "Greater Accra"],
  ["central", "Central"],
  ["western", "Western"],
  ["northern", "Northern"],
  ["volta", "Volta"],
] as const;

/** “+21”, “-1”, “No change” vs the period before. */
function Change({ n }: { n: number | null }) {
  return <span className="text-caption text-text-secondary">{n === null || n === 0 ? "No change" : n > 0 ? `+${n}` : `-${-n}`}</span>;
}

const money = (m: Money) => formatMoney(m.amount_minor, m.currency);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const humanise = (id: string) =>
  id
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** An area’s name from what the response lists, else from its ID (“accra-central” → “Accra Central”). */
function areaName(heat: Heat, id: string) {
  return heat.towns.find((t) => t.id === id)?.name ?? heat.regions.find((r) => r.id === id)?.name ?? REGIONS.find(([r]) => r === id)?.[1] ?? humanise(id);
}

/** The four KPI cards. Country and region show confirmed fraud and what’s new; a district shows money out and its agents. */
function kpisOf(heat: Heat): Kpi[] {
  const { kpis, area, period } = heat;
  const level = area.level;
  const filtered = Boolean(heat.filters?.fraud_type || heat.filters?.region);
  const change = kpis.alerts.change_pct;
  const vs = period === "24h" ? "yesterday" : "the period before";
  const hottest = kpis.hottest_area;
  const cards: Kpi[] = [
    {
      label: `Alerts · ${level === "country" ? period : area.name}`,
      value: kpis.alerts.value.toLocaleString("en-GB"),
      sub:
        change === null
          ? kpis.alerts.value
            ? "No change"
            : [heat.filters?.fraud_type && fraudTypeLabel(heat.filters.fraud_type), heat.filters?.region && areaName(heat, heat.filters.region)].filter(Boolean).join(" · ") ||
              "None matching"
          : `${Math.abs(change)}% ${change >= 0 ? "more" : "fewer"} than ${vs}`,
      icon: "alert",
      tone: change && change > 0 ? "critical" : undefined,
    },
    {
      label: level === "country" ? "Hottest area" : level === "region" ? "Hottest district" : "Hottest neighbourhood",
      value: hottest?.name ?? "None",
      sub: hottest ? `${plural(hottest.alerts, "alert")} · ${plural(hottest.agents, "agent")}` : "No alerts match",
      icon: "pin",
    },
  ];
  if (kpis.money_out) cards.push({ label: "Moved out", value: money(kpis.money_out.money), sub: `Across ${plural(kpis.money_out.wallets, "wallet")}`, icon: "wallet" });
  else if (kpis.confirmed_fraud) {
    cards.push({
      label: "Confirmed fraud",
      value: money(kpis.confirmed_fraud.money),
      sub: filtered && !kpis.confirmed_fraud.cases_closed ? "None today" : `${plural(kpis.confirmed_fraud.cases_closed, "case")} closed today`,
      icon: "wallet",
    });
  }
  if (kpis.agents_in_view) {
    cards.push({
      label: level === "district" ? "Agents in view" : "Agents involved",
      value: String(kpis.agents_in_view.value),
      sub: `${kpis.agents_in_view.with_fraud} with swaps that became fraud`,
      icon: "building",
      tone: "medium",
    });
  } else if (kpis.new_since) {
    const n = kpis.new_since;
    cards.push({
      label: `New since ${formatClock(n.since)}`,
      value: n.value ? `+${n.value}` : "0",
      sub: n.top_area_id ? `Mostly ${areaName(heat, n.top_area_id)}` : "None",
      icon: "activity",
      tone: n.value ? "medium" : undefined,
    });
  }
  return cards;
}

/** The ranking beside the map: towns and regions for Ghana, neighbourhoods and agents for a district. */
function rankingOf(heat: Heat) {
  const { area } = heat;
  const town = (t: Town): Row =>
    area.level === "country"
      ? { id: t.id, name: t.name, parent: t.parent, sub: t.top_fraud_type ? fraudTypeLabel(t.top_fraud_type) : "", value: t.alerts, change: t.change }
      : { id: t.id, name: t.name, sub: t.agents ? `${t.parent} · ${plural(t.agents, "agent")}` : t.parent, value: t.alerts, change: t.change };
  const towns = heat.towns.map(town);
  if (area.level === "country") {
    return {
      title: "Hotspots",
      tabs: ["Towns", "Regions"],
      lists: [towns, heat.regions.map((r): Row => ({ id: r.id, name: r.name, sub: r.top_towns.join(", "), value: r.alerts, change: r.change }))],
    };
  }
  if (area.level === "region") return { title: `${area.name} · by district`, tabs: [] as string[], lists: [towns] };
  return {
    title: `${area.name} · neighbourhoods`,
    tabs: ["Neighbourhoods", "Agents"],
    lists: [
      towns,
      heat.agents.map((a): Row => ({
        id: a.code,
        name: a.code,
        sub: a.swaps_became_fraud ? `${a.area} · ${a.swaps_became_fraud} to fraud` : a.area,
        value: a.alerts,
        change: a.change,
      })),
    ],
  };
}

/** “Alerts per region · last 24h”, or the filters when there are some. */
function legendOf(heat: Heat) {
  const { fraud_type, region } = heat.filters ?? {};
  if (fraud_type || region) return [fraud_type && fraudTypeLabel(fraud_type), region && areaName(heat, region), `last ${heat.period}`].filter(Boolean).join(" · ");
  return `${METRIC[heat.metric] ?? heat.metric} per ${heat.area.level === "country" ? "region" : "district"} · last ${heat.period}`;
}

/** G25 · “No account takeover in Northern today” / “There were 2 in the last 7 days, both in Tamale.” */
function emptyCopy(heat: Heat, empty: NonNullable<Heat["empty"]>) {
  const what = heat.filters?.fraud_type ? fraudTypeLabel(heat.filters.fraud_type).toLowerCase() : "alerts";
  const title = `No ${what} in ${areaName(heat, empty.focus_area_id)} ${heat.period === "24h" ? "today" : `in the last ${heat.period}`}`;
  const n = empty.last_7d;
  const places = empty.last_7d_area_ids.map((id) => areaName(heat, id));
  const where =
    places.length === 1 ? `${n === 1 ? "" : n === 2 ? "both " : "all "}in ${places[0]}` : places.length ? `in ${places.slice(0, -1).join(", ")} and ${places.at(-1)}` : "";
  const detail = n ? `There ${n === 1 ? "was 1" : `were ${n}`} in the last 7 days${where ? `, ${where}` : ""}.` : "None in the last 7 days either.";
  return { title: title[0].toUpperCase() + title.slice(1), detail };
}

/** G21–G27 · Fraud heatmap — Ghana (G21) → region (G22) → district (G23), area drill-down (G24), no match (G25), loading (G26), map failed (G27). */
export default function HeatmapPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const area = params.get("area") ?? "ghana";
  const [metric, setMetric] = useState<"alerts" | "confirmed" | "ghs_lost">("alerts");
  const [fraudType, setFraudType] = useState("");
  const [period, setPeriod] = useState("24h");
  const [region, setRegion] = useState("");
  const [tab, setTab] = useState(0);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const q = new URLSearchParams({ area, metric, period });
  if (fraudType) q.set("fraud_type", fraudType);
  if (region) q.set("region", region);
  const layersQ = new URLSearchParams(q);
  layersQ.delete("metric");
  const { data, error } = useApi<Heat>(`/heatmap?${q}`);
  const { data: layers, error: layersError } = useApi<MapLayers>(`/heatmap/layers?${layersQ}`);
  const { data: detail } = useApi<AreaDetail>(drawer ? `/heatmap/areas/${drawer}?period=${period}` : null);
  const ranking = data && rankingOf(data);
  const empty = data?.empty ? emptyCopy(data, data.empty) : null;
  const hot = detail && detail.alerts > detail.usual_alerts;

  const go = (next: string) => {
    setTab(0);
    setRegion("");
    router.push(next === "ghana" ? "/heatmap" : `/heatmap?area=${next}`, { scroll: false });
  };
  const rows = ranking ? (ranking.lists[tab]?.length ? ranking.lists[tab] : ranking.lists[0]) : [];
  const max = Math.max(1, ...rows.map((r) => r.value));
  const regionLabel = area === "kumasi" ? "Ashanti › Kumasi" : area === "ashanti" ? "Ashanti" : undefined;

  const exportCsv = () => {
    if (!data) return;
    const body = ["area,parent,value,change", ...rows.map((r) => [r.name, r.parent ?? "", r.value, r.change ?? 0].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `heatmap-${area}-${period}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const operator = useOperatorName();
  const filtersOn = Boolean(fraudType || region);
  const clearFilters = () => {
    setFraudType("");
    setRegion("");
    setSearch("");
  };
  const hottest = data?.kpis.hottest_area?.area_id;
  const shown = search.trim() ? rows.filter((r) => `${r.name} ${r.parent ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())) : rows;

  return (
    <>
      <AppHeader section="Investigate" title="Heatmap" />
      <PageBody>
        <PageHead
          title="Fraud heatmap"
          subtitle={`Where fraud is happening on ${operator ? `${operator}’s` : "your"} network${data ? ` · updated ${formatClock(data.updated_at)}, refreshes every ${Math.round(data.refresh_seconds / 60)} min` : ""}`}
          actions={
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!data}>
              Export
            </Button>
          }
        />

        <div className="grid grid-cols-4 gap-4">
          {(data ? kpisOf(data) : Array.from({ length: 4 }, () => null)).map((k, i) =>
            k ? (
              <div key={k.label} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised px-5 py-4">
                <span className="text-caption text-text-secondary">{k.label}</span>
                <span className="truncate text-h2 text-text-primary">{k.value}</span>
                <span className="truncate text-caption text-text-secondary">{k.sub}</span>
              </div>
            ) : (
              <Skeleton key={i} className="h-[106px] rounded-lg" />
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToolbarSearch label="Search a town, district or region" value={search} onChange={setSearch} placeholder="Search a town, district or region" className="w-[260px]" />
          <ToolbarSelect label="Fraud type" value={fraudType} onChange={setFraudType} options={FRAUD_TYPES} active={!!fraudType} />
          <ToolbarSelect
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              ["24h", "Last 24 hours"],
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
            ]}
          />
          <ToolbarSelect
            label="Area"
            value={regionLabel ? area : region}
            active={Boolean(regionLabel || region)}
            onChange={(v) => {
              if (v === "ashanti") go("ashanti");
              else {
                if (area !== "ghana") go("ghana");
                setRegion(v);
              }
            }}
            options={regionLabel ? [[area, regionLabel.replace(" › ", " · ")], ...REGIONS.filter(([id]) => id !== "ashanti")] : REGIONS}
          />
          <BarDivider />
          <SegmentChips
            label="Measure"
            value={metric}
            onChange={setMetric}
            options={[
              { id: "alerts", label: "Alerts" },
              { id: "confirmed", label: "Confirmed fraud" },
              { id: "ghs_lost", label: "GHS lost" },
            ]}
          />
        </div>

        <div className="flex items-start gap-5">
          {layersError ? (
            /* G27 · The map didn’t load — the numbers and the ranking stay live. */
            <section className="flex h-[640px] min-w-0 flex-1 flex-col rounded-lg border border-border-default bg-surface-base px-6 pt-5">
              <h3 className="text-title text-text-primary">Map</h3>
              <EmptyState
                bare
                className="flex-1 pb-16"
                icon="app/icon-alert-circle-tertiary-20"
                title="The map didn’t load"
                actions={
                  <Button variant="secondary" size="md" onClick={() => mutate(`/heatmap/layers?${layersQ}`)} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
                    Retry
                  </Button>
                }
              >
                The map service took too long. The numbers are still live; only the map is missing.
              </EmptyState>
            </section>
          ) : !layers || !data ? (
            /* G26 · Loading. */
            <div className="relative h-[640px] min-w-0 flex-1 overflow-hidden rounded-lg border border-border-default bg-surface-base" aria-busy>
              <Skeleton className="absolute inset-6 rounded-lg" />
              <p className="absolute inset-0 flex items-center justify-center text-body-s text-text-secondary">Loading the map…</p>
            </div>
          ) : (
            <HeatMap
              level={LEVEL[area] ?? "country"}
              layers={{
                shapes: layers.shapes,
                pins: layers.pins.map((p) => ({ id: p.id, name: areaName(data, p.id), alerts: p.alerts, hot: p.id === hottest })),
                agents: data.agents.map((a) => ({ code: a.code, hot: a.hot })),
              }}
              legendTitle={legendOf(data)}
              focus={data.empty?.focus_area_id}
              onDrill={go}
              onPin={setDrawer}
              overlay={
                empty && (
                  <EmptyCard
                    title={empty.title}
                    detail={empty.detail}
                    onWeek={() => setPeriod("7d")}
                    onAll={() => {
                      setRegion("");
                      setFraudType("");
                    }}
                  />
                )
              }
            >
              {data.area.path.length > 0 && (
                <nav
                  aria-label="Map level"
                  className="flex w-fit items-center gap-1.5 rounded-lg border border-border-default bg-surface-base py-1 pr-3 pl-1 text-label-s shadow-sm"
                >
                  <button
                    type="button"
                    aria-label="Up one level"
                    onClick={() => go(data.area.path[data.area.path.length - 1].id)}
                    className="flex size-7 items-center justify-center rounded-md bg-surface-sunken"
                  >
                    <Icon name="app/icon-arrow-left-18" size={14} />
                  </button>
                  {data.area.path.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5">
                      <button type="button" onClick={() => go(p.id)} className="rounded text-text-brand hover:underline">
                        {p.name}
                      </button>
                      <Icon name="app/icon-chevron-right-16" size={12} />
                    </span>
                  ))}
                  <span className="text-text-primary">{data.area.name}</span>
                </nav>
              )}
            </HeatMap>
          )}

          <Card title={ranking?.title ?? "Hotspots"} aside={shown.length > 0 ? <CardMeta>vs yesterday</CardMeta> : undefined} className="w-[324px] shrink-0">
            {ranking && ranking.tabs.length > 0 && shown.length > 0 && (
              <SegmentChips
                label="Rank by"
                value={String(tab)}
                onChange={(v) => setTab(Number(v))}
                options={ranking.tabs.map((t, i) => ({ id: String(i), label: t, count: i === 1 && data?.area.level === "district" ? ranking.lists[1]?.length : undefined }))}
              />
            )}
            {!data ? (
              <Skeleton className="h-[420px] w-full rounded-lg" />
            ) : shown.length === 0 ? (
              /* G25 · Nothing for these filters. */
              <EmptyState
                bare
                icon="app/icon-search-18"
                title="No alerts match these filters"
                actions={
                  (filtersOn || search) && (
                    <Button variant="secondary" size="md" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )
                }
              >
                {search.trim()
                  ? `Nothing called “${search.trim()}” in this view.`
                  : `Nothing for ${[data.filters?.fraud_type && fraudTypeLabel(data.filters.fraud_type).toLowerCase(), data.filters?.region && `in ${areaName(data, data.filters.region)}`].filter(Boolean).join(" ") || "this view"} in the last ${data.period === "24h" ? "24 hours" : data.period}.`}
              </EmptyState>
            ) : (
              <ol className="flex flex-col">
                {shown.map((r, i) => {
                  // Adum, Kumasi opens the Kumasi district, where Adum’s detail lives.
                  const drill = r.id === "ashanti" || r.id === "kumasi" || r.id === "adum-kumasi" ? (r.id === "adum-kumasi" ? "kumasi" : r.id) : null;
                  const open = () =>
                    drill && drill !== area
                      ? go(drill)
                      : r.id.startsWith("AG-")
                        ? router.push(`/network?seed=${r.id}`)
                        : data.towns.some((t) => t.id === r.id)
                          ? setDrawer(r.id)
                          : undefined;
                  return (
                    <li key={r.id} className="border-b border-border-default last:border-b-0">
                      <button type="button" onClick={open} className="flex w-full flex-col gap-1.5 py-2.5 text-left hover:bg-surface-raised">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-caption text-text-secondary">{i + 1}</span>
                          <span className="text-label-s text-text-primary">{r.name}</span>
                          {r.parent && <span className="truncate text-caption text-text-secondary">{r.parent}</span>}
                          <span className="flex-1" />
                          <span className="text-label-s text-text-primary tabular-nums">{r.value}</span>
                        </span>
                        <span className="h-1 rounded-full bg-surface-sunken">
                          <span className="block h-1 rounded-full bg-neutral-fg" style={{ width: `${(r.value / max) * 100}%` }} />
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-caption text-text-secondary">{r.sub}</span>
                          <Change n={r.change} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        {error && !data && <p className="text-body-s text-critical-fg">The numbers didn’t load. They’ll retry automatically.</p>}
      </PageBody>

      {drawer && (
        /* G24 · Drill-down into an area. */
        <Drawer
          open
          onClose={() => setDrawer(null)}
          width={460}
          badges={hot ? <Badge label="Hotspot" tone="critical" /> : undefined}
          title={detail ? [detail.name, ...detail.path.filter((p) => p.id !== "ghana" && p.id !== "ashanti").map((p) => p.name.replace(/ Metro$/, ""))].join(", ") : "…"}
          subtitle={detail?.summary}
          footer={
            <>
              <Button variant="ghost" size="md" onClick={() => setDrawer(null)}>
                Close
              </Button>
              <span className="flex-1" />
              {detail?.agent_list[0] && (
                <ButtonLink href={`/network?seed=${detail.agent_list[0].code}`} variant="secondary" size="md">
                  Open {detail.agent_list[0].code} in network
                </ButtonLink>
              )}
              <ButtonLink href={`/alerts?area=${detail?.id ?? drawer}`} size="md">
                Triage {detail?.untriaged.total ?? ""} alerts
              </ButtonLink>
            </>
          }
        >
          {!detail ? (
            <Skeleton className="h-[400px] w-full rounded-lg" />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    [`Alerts · ${detail.period}`, String(detail.alerts), !detail.usual_alerts ? "" : detail.alerts >= detail.usual_alerts * 2 ? `${Math.round(detail.alerts / detail.usual_alerts)} times the usual` : `Usually ${detail.usual_alerts}`],
                    ["Agents", String(detail.agents), `In ${detail.name}`],
                    ["Moved out", money(detail.moved_out), `From ${detail.name} wallets`],
                  ] as const
                ).map(([l, v, sub]) => (
                  <div key={l} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border-default bg-surface-raised px-3.5 py-3">
                    <span className="text-caption text-text-secondary">{l}</span>
                    <span className="truncate text-h3 text-text-primary">{v}</span>
                    <span className="truncate text-caption text-text-secondary">{sub}</span>
                  </div>
                ))}
              </div>
              <Card title="What’s driving it">
                <ul className="flex flex-col">
                  {detail.drivers.map((d) => (
                    <li key={d.fraud_type} className="flex justify-between border-b border-border-default py-2.5 text-body-s last:border-b-0 last:pb-0">
                      <span className="text-text-secondary">{fraudTypeLabel(d.fraud_type)}</span>
                      <span className="text-text-primary">{plural(d.alerts, "alert")}</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title={`Agents in ${detail.name}`} aside={<CardMeta>{detail.agent_list.length}</CardMeta>}>
                <ul className="flex flex-col">
                  {detail.agent_list.map((a) => (
                    <li key={a.code} className="flex items-center gap-3 border-b border-border-default py-2.5 last:border-b-0 last:pb-0">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/network?seed=${a.code}`} className="w-fit rounded text-body-s text-text-primary hover:underline">
                          {a.code}
                        </Link>
                        <span className="truncate text-caption text-text-secondary">
                          {a.street} · {plural(a.swaps_today, "swap")} today
                        </span>
                      </span>
                      <Badge
                        label={a.swaps_became_fraud ? `${a.swaps_became_fraud} became fraud` : "None"}
                        tone={a.swaps_became_fraud > 1 ? "critical" : a.swaps_became_fraud ? "high" : "neutral"}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
              <Card
                title="Untriaged alerts"
                aside={
                  <span className="flex items-center gap-3">
                    <CardMeta>{detail.untriaged.total}</CardMeta>
                    <CardLink href={`/alerts?area=${detail.id}`}>View all</CardLink>
                  </span>
                }
              >
                <ul className="flex flex-col">
                  {detail.untriaged.data.map((a) => (
                    <li key={a.id} className="border-b border-border-default last:border-b-0">
                      <Link href={`/alerts?open=${a.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-raised">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body-s text-text-primary">
                            {fraudTypeLabel(a.fraud_type)} · {localMsisdn(a.subscriber.msisdn)}
                          </span>
                          <span className="text-caption text-text-secondary">{a.id}</span>
                        </span>
                        <RiskPill score={a.risk_score} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}

/** “94 Critical” — score and level in one pill (untriaged alerts in the drill-down). */
function RiskPill({ score }: { score: number }) {
  const t = riskTone(score);
  return <Badge label={`${score} ${t[0].toUpperCase()}${t.slice(1)}`} tone={t === "low" ? "neutral" : t} />;
}

/** G25 · Nothing for these filters — said over the map, with the two ways out. */
function EmptyCard({ title, detail, onWeek, onAll }: { title: string; detail: string; onWeek: () => void; onAll: () => void }) {
  return (
    <div role="status" className="flex w-[380px] flex-col items-center gap-2 rounded-lg border border-border-default bg-surface-base px-6 py-6 text-center shadow-lg">
      <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-success-bg">
        <Icon name="app/icon-check-circle-success-20" size={20} />
      </span>
      <p className="text-title text-text-primary">{title}</p>
      <p className="text-body-s text-text-secondary">{detail}</p>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" size="md" onClick={onWeek}>
          Show last 7 days
        </Button>
        <Button size="md" onClick={onAll}>
          All regions
        </Button>
      </div>
    </div>
  );
}
