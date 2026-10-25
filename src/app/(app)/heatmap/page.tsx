"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { HeatMap } from "@/components/heatmap/HeatMap";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { fraudTypeLabel, useApi, type Money, type SubscriberRef } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
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

const KPI_ICON: Record<string, string> = {
  alert: "app/icon-alert-triangle-secondary-18",
  pin: "app/icon-map-pin-secondary-18",
  wallet: "app/icon-wallet-18",
  activity: "app/icon-activity-secondary-18",
  building: "app/icon-building-tertiary-18",
};
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
const BAR = ["bg-critical-fg", "bg-high-fg", "bg-high-fg", "bg-high-fg", "bg-high-fg", "bg-medium-fg", "bg-medium-fg"];

function ToolbarSelect({ icon, label, value, onChange, options }: { icon: string; label: string; value: string; onChange: (v: string) => void; options: ReadonlyArray<readonly [string, string]> }) {
  return (
    <label className="relative flex h-10 w-[200px] items-center gap-2 rounded-lg border border-border-default bg-surface-base pr-8 pl-3 focus-within:border-border-focus focus-within:shadow-focus">
      <Icon name={icon} size={16} />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent text-body-m text-text-primary outline-none focus-visible:shadow-none">
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
      <Icon name="app/icon-chevron-down-16" size={16} className="pointer-events-none absolute right-3" />
    </label>
  );
}

function Change({ n }: { n: number | null }) {
  if (n === null || n === 0) return <span className="text-caption text-text-tertiary">no change</span>;
  return <span className={cn("text-caption font-medium", n > 0 ? "text-critical-fg" : "text-text-tertiary")}>{n > 0 ? `▲ ${n}` : `▼ ${-n}`}</span>;
}

const money = (m: Money) => formatMoney(m.amount_minor, m.currency);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const humanise = (id: string) => id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

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
      sub: change === null ? (kpis.alerts.value ? "no change" : "none matching") : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs ${vs}`,
      icon: "alert",
      tone: change && change > 0 ? "critical" : undefined,
    },
    {
      label: level === "country" ? "Hottest area" : level === "region" ? "Hottest district" : "Hottest neighbourhood",
      value: hottest?.name ?? "—",
      sub: hottest ? `${plural(hottest.alerts, "alert")} · ${plural(hottest.agents, "agent")}` : "no activity",
      icon: "pin",
    },
  ];
  if (kpis.money_out) cards.push({ label: "Moved out", value: money(kpis.money_out.money), sub: `across ${plural(kpis.money_out.wallets, "wallet")}`, icon: "wallet" });
  else if (kpis.confirmed_fraud) {
    const region = heat.filters?.region;
    cards.push({
      label: "Confirmed fraud",
      value: money(kpis.confirmed_fraud.money),
      sub: filtered && region && !kpis.confirmed_fraud.cases_closed ? `in ${areaName(heat, region)} today` : `${plural(kpis.confirmed_fraud.cases_closed, "case")} closed today`,
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
      sub: n.top_area_id ? `mostly ${areaName(heat, n.top_area_id)}` : "—",
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
      heat.agents.map((a): Row => ({ id: a.code, name: a.code, sub: a.swaps_became_fraud ? `${a.area} · ${a.swaps_became_fraud} to fraud` : a.area, value: a.alerts, change: a.change })),
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
  const where = places.length === 1 ? `${n === 1 ? "" : n === 2 ? "both " : "all "}in ${places[0]}` : places.length ? `in ${places.slice(0, -1).join(", ")} and ${places.at(-1)}` : "";
  const detail = n ? `There ${n === 1 ? "was 1" : `were ${n}`} in the last 7 days${where ? `, ${where}` : ""}.` : "None in the last 7 days either.";
  return { title: title[0].toUpperCase() + title.slice(1), detail };
}

/** G21–G27 · Fraud heatmap — Ghana → region → district, with the agents, alerts and cases behind each area. */
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

  return (
    <>
      <AppHeader section="Investigate" title="Heatmap" />
      <PageBody>
        <PageHead
          title="Fraud heatmap"
          subtitle="Where fraud is happening across Kasa Mobile’s network right now. Click an area to see the agents, alerts and cases behind it."
          actions={
            <Button variant="secondary" size="md" onClick={exportCsv} disabled={!data} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
              Export
            </Button>
          }
        />

        <div className="grid grid-cols-4 gap-4">
          {(data ? kpisOf(data) : Array.from({ length: 4 }, () => null)).map((k, i) =>
            k ? (
              <div key={k.label} className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-base px-5 py-4">
                <span className="flex items-center justify-between text-caption text-text-secondary">
                  {k.label}
                  <Icon name={KPI_ICON[k.icon]} size={18} />
                </span>
                <span className="text-h1 text-text-primary">{k.value}</span>
                <span className={cn("text-caption", k.tone === "critical" ? "text-critical-fg" : k.tone === "medium" ? "text-medium-fg" : "text-text-secondary")}>{k.sub}</span>
              </div>
            ) : (
              <Skeleton key={i} className="h-[126px] rounded-xl" />
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Measure"
            value={metric}
            onChange={setMetric}
            options={[
              { id: "alerts", label: "Alerts" },
              { id: "confirmed", label: "Confirmed fraud" },
              { id: "ghs_lost", label: "GHS lost" },
            ]}
          />
          <ToolbarSelect icon="app/icon-filter-18" label="Fraud type" value={fraudType} onChange={setFraudType} options={FRAUD_TYPES} />
          <ToolbarSelect
            icon="app/icon-clock-secondary-16"
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
            icon="app/icon-map-16"
            label="Area"
            value={regionLabel ? area : region}
            onChange={(v) => {
              if (v === "ashanti") go("ashanti");
              else {
                if (area !== "ghana") go("ghana");
                setRegion(v);
              }
            }}
            options={regionLabel ? [[area, regionLabel], ...REGIONS.filter(([id]) => id !== "ashanti")] : REGIONS}
          />
          <span className="flex-1" />
          <span className="text-caption text-text-tertiary">{data ? `Updated ${formatClock(data.updated_at)} · refreshes every 5 min` : ""}</span>
        </div>

        <div className="flex items-start gap-4">
          {layersError ? (
            <EmptyState
              icon="icon-alert-circle-critical-20"
              tone="critical"
              title="The map didn’t load"
              className="h-[640px] min-w-0 flex-1"
              actions={
                <Button variant="secondary" size="md" onClick={() => mutate(`/heatmap/layers?${layersQ}`)} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
                  Try again
                </Button>
              }
            >
              The map service took too long. Your numbers above are still live. Only the map is missing.
            </EmptyState>
          ) : !layers || !data ? (
            <div className="relative h-[640px] min-w-0 flex-1 overflow-hidden rounded-xl border border-border-subtle bg-surface-base" aria-busy>
              <Skeleton className="absolute inset-6 rounded-xl" />
              <p className="absolute inset-0 flex items-center justify-center text-body-s text-text-secondary">Loading the map…</p>
            </div>
          ) : (
            <HeatMap
              level={LEVEL[area] ?? "country"}
              layers={{
                shapes: layers.shapes,
                pins: layers.pins.map((p) => ({ id: p.id, name: areaName(data, p.id), alerts: p.alerts })),
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
                <nav aria-label="Map level" className="flex w-fit items-center gap-1.5 rounded-[10px] border border-border-subtle bg-surface-base py-1 pr-3 pl-1 text-label-s shadow-sm">
                  <button
                    type="button"
                    aria-label="Up one level"
                    onClick={() => go(data.area.path[data.area.path.length - 1].id)}
                    className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken"
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

          <section aria-label={ranking?.title ?? "Hotspots"} className="flex w-[400px] shrink-0 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-base px-5 py-4">
            <header className="flex items-center gap-2">
              <Icon name={area === "ghana" ? "app/icon-zap-secondary-18" : "app/icon-map-pin-secondary-16"} size={16} />
              <h3 className="text-title text-text-primary">{ranking?.title ?? "Hotspots"}</h3>
              <span className="rounded-full bg-surface-sunken px-1.5 text-caption font-medium text-text-tertiary">{rows.length}</span>
              <span className="flex-1" />
              {rows.length > 0 && <span className="text-caption text-text-tertiary">vs yesterday</span>}
            </header>
            {ranking && ranking.tabs.length > 0 && rows.length > 0 && (
              <div className="w-fit">
                <Segmented
                  label="Rank by"
                  value={String(tab)}
                  onChange={(v) => setTab(Number(v))}
                  options={ranking.tabs.map((t, i) => ({ id: String(i), label: t, count: i === 1 && data?.area.level === "district" ? ranking.lists[1]?.length : undefined }))}
                />
              </div>
            )}
            {!data ? (
              <Skeleton className="h-[420px] w-full rounded-lg" />
            ) : rows.length === 0 ? (
              <p className="text-body-s text-text-secondary">No areas match these filters.</p>
            ) : (
              <ol className="flex flex-col">
                {rows.map((r, i) => {
                  // Adum, Kumasi opens the Kumasi district, where Adum’s detail lives.
                  const drill = r.id === "ashanti" || r.id === "kumasi" || r.id === "adum-kumasi" ? (r.id === "adum-kumasi" ? "kumasi" : r.id) : null;
                  const open = () => (drill && drill !== area ? go(drill) : r.id === "adum" ? setDrawer("adum") : r.id.startsWith("AG-") ? router.push(`/network?seed=${r.id}`) : undefined);
                  return (
                    <li key={r.id} className="border-b border-border-subtle last:border-b-0">
                      <button type="button" onClick={open} className="flex w-full items-start gap-3 py-2.5 text-left">
                        <span className="w-3 pt-0.5 text-caption text-text-tertiary">{i + 1}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="text-label-m text-text-primary">
                            {r.name}
                            {r.parent && <span className="text-caption font-normal text-text-tertiary"> · {r.parent}</span>}
                          </span>
                          <span className="h-1 rounded-full bg-surface-sunken">
                            <span className={cn("block h-1 rounded-full", BAR[Math.min(i, BAR.length - 1)])} style={{ width: `${(r.value / max) * 100}%` }} />
                          </span>
                          <span className="text-caption text-text-secondary">{r.sub}</span>
                        </span>
                        <span className="flex w-16 flex-col items-end">
                          <span className="text-title text-text-primary">{r.value}</span>
                          <Change n={r.change} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {error && !data && <p className="text-body-s text-critical-fg">The numbers didn’t load. They’ll retry automatically.</p>}
      </PageBody>

      {drawer && (
        <Drawer
          open
          onClose={() => setDrawer(null)}
          width={520}
          badges={
            <span className="flex items-center gap-2">
              <Badge label="Hotspot" tone="critical" dot />
              <span className="text-caption text-text-secondary">
                {detail?.path
                  .filter((p) => p.id !== "ghana")
                  .reverse()
                  .map((p) => p.name)
                  .join(" · ")}
              </span>
            </span>
          }
          title={detail?.name ?? "…"}
          subtitle={detail?.summary}
          footer={
            <>
              <ButtonLink href={`/network?seed=${detail?.agent_list[0]?.code ?? ""}`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-network-primary-16" size={16} />}>
                Open {detail?.agent_list[0]?.code} in network
              </ButtonLink>
              <span className="flex-1" />
              <ButtonLink href={`/alerts?area=${detail?.id ?? drawer}`} size="md" iconRight={<Icon name="app/icon-arrow-right-white-16" size={16} />}>
                Triage {detail?.untriaged.total ?? ""} alerts
              </ButtonLink>
            </>
          }
        >
          {!detail ? (
            <Skeleton className="h-[400px] w-full rounded-xl" />
          ) : (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    [String(detail.alerts), `alerts · ${detail.period}`, hot],
                    [String(detail.agents), `agents in ${detail.name}`, false],
                    [money(detail.moved_out), "moved out", detail.moved_out.amount_minor > 0],
                  ] as const
                ).map(([v, l, critical]) => (
                  <div key={l} className="flex flex-col rounded-[10px] bg-surface-raised px-3.5 py-3">
                    <span className={cn("text-h3", critical ? "text-critical-fg" : "text-text-primary")}>{v}</span>
                    <span className="text-caption text-text-secondary">{l}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-overline text-text-tertiary uppercase">What’s driving it</p>
                {detail.drivers.map((d, i) => (
                  <div key={d.fraud_type} className="flex flex-col gap-1">
                    <span className="flex justify-between text-body-s text-text-primary">
                      {fraudTypeLabel(d.fraud_type)}
                      <span>{d.alerts}</span>
                    </span>
                    <span className="h-1 rounded-full bg-surface-sunken">
                      <span
                        className={cn("block h-1 rounded-full", i === 0 ? "bg-critical-fg" : i === 1 ? "bg-high-fg" : "bg-medium-fg")}
                        style={{ width: `${(d.alerts / Math.max(1, detail.drivers[0].alerts)) * 100}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-overline text-text-tertiary uppercase">Agents in {detail.name}</p>
                <div className="overflow-hidden rounded-[10px] border border-border-subtle">
                  <table className="w-full text-left">
                    <thead className="bg-surface-raised">
                      <tr className="text-overline text-text-tertiary uppercase">
                        <th className="py-2 pl-3.5 font-bold">Agent</th>
                        <th className="py-2 font-bold">Today</th>
                        <th className="py-2 pr-3.5 text-right font-bold">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.agent_list.map((a) => (
                        <tr key={a.code} className={cn("border-t border-border-subtle", a.swaps_became_fraud > 1 && "shadow-[inset_3px_0_0_#b51c1c]")}>
                          <td className="py-2.5 pl-3.5">
                            <Link href={`/network?seed=${a.code}`} className="rounded font-mono text-mono-m text-text-brand hover:underline">
                              {a.code}
                            </Link>
                            <p className="text-caption text-text-secondary">
                              {detail.name} · {a.street}
                            </p>
                          </td>
                          <td className="py-2.5 text-body-s text-text-secondary">{a.swaps_today} swaps</td>
                          <td className="py-2.5 pr-3.5 text-right">
                            <Badge
                              label={a.swaps_became_fraud ? `${a.swaps_became_fraud} to fraud` : "0"}
                              tone={a.swaps_became_fraud > 1 ? "critical" : a.swaps_became_fraud ? "high" : "neutral"}
                              dot={a.swaps_became_fraud > 0}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="flex items-center justify-between text-overline text-text-tertiary uppercase">
                  Untriaged alerts · {detail.untriaged.total}
                  <Link href={`/alerts?area=${detail.id}`} className="rounded text-label-s tracking-normal text-text-brand normal-case hover:underline">
                    View all
                  </Link>
                </p>
                {detail.untriaged.data.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
                    <span className={cn("w-6 text-label-m", a.risk_score >= 90 ? "text-critical-fg" : "text-high-fg")}>{a.risk_score}</span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-body-s text-text-primary">
                        {fraudTypeLabel(a.fraud_type)} · {a.subscriber.msisdn}
                      </span>
                      <span className="font-mono text-mono-s text-text-tertiary">{a.id}</span>
                    </span>
                    <Link href={`/alerts?open=${a.id}`} className="rounded text-label-s text-text-brand hover:underline">
                      Triage
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}

/** G25 · Nothing for these filters — said over the map, with the two ways out. */
function EmptyCard({ title, detail, onWeek, onAll }: { title: string; detail: string; onWeek: () => void; onAll: () => void }) {
  return (
    <div role="status" className="flex w-[380px] flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-base px-6 py-5 text-center shadow-lg">
      <span className="flex size-11 items-center justify-center rounded-xl bg-success-bg">
        <Icon name="app/icon-check-circle-success-22" size={20} />
      </span>
      <p className="text-title text-text-primary">{title}</p>
      <p className="text-body-s text-text-secondary">{detail}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onWeek}>
          Show last 7 days
        </Button>
        <Button size="sm" onClick={onAll}>
          All regions
        </Button>
      </div>
    </div>
  );
}
