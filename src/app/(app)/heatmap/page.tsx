"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { HeatMap, type Layers } from "@/components/heatmap/HeatMap";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

type Kpi = { label: string; value: string; sub: string; icon: string; tone?: "critical" | "medium" };
type Row = { id: string; name: string; parent?: string; sub: string; value: number; change: number | null };
type Heat = {
  area: { id: string; name: string; level: string; path: Array<{ id: string; name: string }> };
  kpis: Kpi[];
  ranking: { title: string; tabs: string[]; rows: Row[]; regions: Row[]; footer: string | null };
  legend: string;
  updated_at: string;
  empty?: { title: string; detail: string; focus: string };
};
type AreaDetail = {
  name: string;
  path: string;
  summary: string;
  tiles: Array<[string, string, string | null]>;
  drivers: Array<{ label: string; value: number; tone: string }>;
  agents: Array<{ id: string; where: string; today: number; to_fraud: number; hot: boolean }>;
  untriaged: { total: number; data: Array<{ id: string; risk: number; title: string }> };
};

const KPI_ICON: Record<string, string> = {
  alert: "app/icon-alert-triangle-secondary-18",
  pin: "app/icon-map-pin-secondary-18",
  wallet: "app/icon-wallet-18",
  activity: "app/icon-activity-secondary-18",
  building: "app/icon-building-tertiary-18",
};
const LEVEL: Record<string, "country" | "ashanti" | "kumasi"> = { ghana: "country", ashanti: "ashanti", kumasi: "kumasi" };
const FRAUD_TYPES = [
  ["", "All fraud types"],
  ["sim_swap_to_momo", "SIM swap to MoMo"],
  ["account_takeover", "Account takeover"],
  ["wallet_takeover", "Wallet takeover"],
  ["agent_fraud", "Agent fraud"],
] as const;
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
  if (params.get("demo")) q.set("demo", params.get("demo")!);
  // TODO(api): GET /heatmap returns {area, alerts, confirmed_fraud, change_pct}; KPIs, ranking and layers are proposed.
  const { data, error } = useApi<Heat>(`/heatmap?${q}`);
  const { data: layers, error: layersError } = useApi<Layers>(`/heatmap/layers?${q}`);
  const { data: detail } = useApi<AreaDetail>(drawer ? `/heatmap/areas/${drawer}` : null);

  const go = (next: string) => {
    setTab(0);
    setRegion("");
    router.push(next === "ghana" ? "/heatmap" : `/heatmap?area=${next}`, { scroll: false });
  };
  const rows = data ? (tab === 1 && data.ranking.regions.length ? data.ranking.regions : data.ranking.rows) : [];
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
          {(data?.kpis ?? Array.from({ length: 4 }, () => null)).map((k, i) =>
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
                <Button variant="secondary" size="md" onClick={() => mutate(`/heatmap/layers?${q}`)} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
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
              layers={layers}
              legendTitle={data.legend}
              focus={data.empty?.focus}
              onDrill={go}
              onPin={setDrawer}
              overlay={
                data.empty && (
                  <EmptyCard
                    title={data.empty.title}
                    detail={data.empty.detail}
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

          <section aria-label={data?.ranking.title ?? "Hotspots"} className="flex w-[400px] shrink-0 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-base px-5 py-4">
            <header className="flex items-center gap-2">
              <Icon name={area === "ghana" ? "app/icon-zap-secondary-18" : "app/icon-map-pin-secondary-16"} size={16} />
              <h3 className="text-title text-text-primary">{data?.ranking.title ?? "Hotspots"}</h3>
              <span className="rounded-full bg-surface-sunken px-1.5 text-caption font-medium text-text-tertiary">{rows.length}</span>
              <span className="flex-1" />
              {rows.length > 0 && <span className="text-caption text-text-tertiary">vs yesterday</span>}
            </header>
            {data && data.ranking.tabs.length > 0 && (
              <div className="w-fit">
                <Segmented
                  label="Rank by"
                  value={String(tab)}
                  onChange={(v) => setTab(Number(v))}
                  options={data.ranking.tabs.map((t, i) => ({ id: String(i), label: t, count: i === 1 && area === "kumasi" ? data.ranking.regions.length : undefined }))}
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
                  const drill = r.id === "ashanti" || r.id === "kumasi" || r.id === "adum-kumasi" ? (r.id === "adum-kumasi" ? "ashanti" : r.id) : null;
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
            {data?.ranking.footer && <p className="text-caption text-text-tertiary">{data.ranking.footer}</p>}
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
              <span className="text-caption text-text-secondary">{detail?.path}</span>
            </span>
          }
          title={detail?.name ?? "…"}
          subtitle={detail?.summary}
          footer={
            <>
              <ButtonLink href={`/network?seed=${detail?.agents[0]?.id ?? ""}`} variant="secondary" size="md" iconLeft={<Icon name="app/icon-network-primary-16" size={16} />}>
                Open {detail?.agents[0]?.id} in network
              </ButtonLink>
              <span className="flex-1" />
              <ButtonLink href="/alerts?area=adum" size="md" iconRight={<Icon name="app/icon-arrow-right-white-16" size={16} />}>
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
                {detail.tiles.map(([v, l, tone]) => (
                  <div key={l} className="flex flex-col rounded-[10px] bg-surface-raised px-3.5 py-3">
                    <span className={cn("text-h3", tone === "critical" ? "text-critical-fg" : "text-text-primary")}>{v}</span>
                    <span className="text-caption text-text-secondary">{l}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-overline text-text-tertiary uppercase">What’s driving it</p>
                {detail.drivers.map((d) => (
                  <div key={d.label} className="flex flex-col gap-1">
                    <span className="flex justify-between text-body-s text-text-primary">
                      {d.label}
                      <span>{d.value}</span>
                    </span>
                    <span className="h-1 rounded-full bg-surface-sunken">
                      <span
                        className={cn("block h-1 rounded-full", d.tone === "critical" ? "bg-critical-fg" : d.tone === "high" ? "bg-high-fg" : "bg-medium-fg")}
                        style={{ width: `${(d.value / detail.drivers[0].value) * 100}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-overline text-text-tertiary uppercase">Agents in Adum</p>
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
                      {detail.agents.map((a) => (
                        <tr key={a.id} className={cn("border-t border-border-subtle", a.hot && "shadow-[inset_3px_0_0_#b51c1c]")}>
                          <td className="py-2.5 pl-3.5">
                            <Link href={`/network?seed=${a.id}`} className="rounded font-mono text-mono-m text-text-brand hover:underline">
                              {a.id}
                            </Link>
                            <p className="text-caption text-text-secondary">{a.where}</p>
                          </td>
                          <td className="py-2.5 text-body-s text-text-secondary">{a.today} swaps</td>
                          <td className="py-2.5 pr-3.5 text-right">
                            <Badge label={a.to_fraud ? `${a.to_fraud} to fraud` : "0"} tone={a.to_fraud > 1 ? "critical" : a.to_fraud ? "high" : "neutral"} dot={a.to_fraud > 0} />
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
                  <Link href="/alerts?area=adum" className="rounded text-label-s tracking-normal text-text-brand normal-case hover:underline">
                    View all
                  </Link>
                </p>
                {detail.untriaged.data.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
                    <span className={cn("w-6 text-label-m", a.risk >= 90 ? "text-critical-fg" : "text-high-fg")}>{a.risk}</span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-body-s text-text-primary">{a.title}</span>
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
