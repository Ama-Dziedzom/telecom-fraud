"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Card, CardMeta, Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { localMsisdn } from "@/components/cases/CaseTable";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, useNow } from "@/lib/time";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Step = { id: string; state: "done" | "running" | "waiting"; done: number; total: number | null };
type TraceFlow = {
  in: Array<{ source: "international" | "local"; calls: number }>;
  sim: { calls_out: number; cells: number };
  out: Array<{ operator: { id: string; name: string }; numbers: number; calls: number; lower_bound: boolean }>;
  call_backs: { numbers: number; calls: number };
};
type Trace = {
  id: string;
  subject: { msisdn: string; subscriber_id: string };
  period: string;
  status: "running" | "ready" | "no_calls";
  progress_pct: number;
  steps?: Step[];
  /** Engine text. */
  verdict?: { kind: string; title: string; detail: string };
  flow?: TraceFlow;
  /** Calls out per hour, 00–23; null while an hour’s records are missing. */
  hourly_calls?: Array<number | null>;
  signs?: { avg_call_seconds: number; cells_used: number; call_backs: number; sim_age_days: number };
  case_id?: string | null;
  gaps?: { feed: string; delayed_since: string; covered_hours: number; missing_hours: number[] } | null;
};
type FlowNode = { id: string; label: string; detail: string; calls: number; tone?: "high"; icon: string };

const W = 1306;
const H = 300;
const PERIOD: Record<string, string> = { "24h": "last 24 hours", "7d": "last 7 days" };
const n = (v: number) => v.toLocaleString("en-GB");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

const STEP: Record<string, { label: string; detail: (s: Step) => string }> = {
  fetch_records: { label: "Fetched call records", detail: (s) => `${n(s.done)} records from our call records and interconnect feeds` },
  match_operators: { label: "Matching numbers to operators", detail: (s) => `${n(s.done)} of ${n(s.total ?? s.done)} done` },
  find_patterns: { label: "Spotting patterns", detail: () => "Usually under 20 seconds" },
};
const SOURCE: Record<string, { label: string; icon: string; tone?: "high" }> = {
  international: { label: "International route", icon: "globe", tone: "high" },
  local: { label: "Local numbers", icon: "phone" },
};
const FEED: Record<string, string> = { interconnect: "interconnect", cdr: "call record" };
const VERDICT_BADGE: Record<string, string> = { sim_box: "SIM box suspected" };

/** The flow chart’s boxes: where calls come in from, this SIM, and where they go. */
function flowNodes(flow: TraceFlow) {
  const plus = (lowerBound: boolean) => (lowerBound ? "+" : "");
  return {
    in: flow.in.map((f) => ({
      id: f.source,
      label: SOURCE[f.source]?.label ?? f.source,
      detail: `${n(f.calls)} calls in`,
      calls: f.calls,
      tone: SOURCE[f.source]?.tone,
      icon: SOURCE[f.source]?.icon ?? "phone",
    })),
    sim: { label: "This SIM", detail: `${n(flow.sim.calls_out)} calls out · ${plural(flow.sim.cells, "cell")}` },
    out: [
      ...flow.out.map((o) => ({
        id: o.operator.id,
        label: `${o.operator.name} numbers`,
        detail: `${n(o.numbers)}${plus(o.lower_bound)} numbers · ${n(o.calls)}${plus(o.lower_bound)} calls`,
        calls: o.calls,
        icon: "phone",
      })),
      { id: "call_backs", label: "Contacts who call back", detail: plural(flow.call_backs.numbers, "number"), calls: flow.call_backs.calls, icon: "users" },
    ],
  };
}

/** The four tiles, each with the plain-words reading underneath. */
function signTiles(s: NonNullable<Trace["signs"]>, now: number) {
  const activated = new Date(now - s.sim_age_days * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return [
    { value: `${s.avg_call_seconds} s`, label: "Average call", sub: "People average 2-3 min" },
    { value: n(s.cells_used), label: s.cells_used === 1 ? "Cells it uses" : "Cells it uses", sub: s.cells_used === 1 ? "It never moves" : `${n(s.cells_used)} cells` },
    { value: n(s.call_backs), label: "Calls back", sub: s.call_backs === 0 ? "Nobody calls it" : `${plural(s.call_backs, "call")} back` },
    { value: plural(s.sim_age_days, "day"), label: "SIM age", sub: `Activated ${activated}` },
  ];
}

/** G35 · In → this SIM → out, ribbon thickness = number of calls. */
function Flow({ flow }: { flow: ReturnType<typeof flowNodes> }) {
  const max = Math.max(...flow.in.map((n) => n.calls), ...flow.out.map((n) => n.calls), 1);
  const width = (calls: number) => (calls ? Math.max(3, (calls / max) * 26) : 1);
  const inY = [72, 222];
  const outY = [42, 142, 242];
  const simTop = 108;
  const pct = (x: number) => `${(x / W) * 100}%`;
  return (
    <div className="relative h-[300px] w-full">
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {flow.in.map((n, i) => {
          const y2 = simTop + 30 + i * 22;
          return (
            <path
              key={n.id}
              d={`M 280 ${inY[i]} C 390 ${inY[i]}, 390 ${y2}, 500 ${y2}`}
              fill="none"
              stroke={n.tone === "high" ? "var(--color-critical-solid)" : "var(--color-border-strong)"}
              strokeOpacity={n.tone === "high" ? 0.85 : 1}
              strokeWidth={n.tone === "high" ? width(n.calls) : 1.5}
            />
          );
        })}
        {flow.out.map((n, i) => {
          const y1 = simTop + 26 + i * 16;
          return (
            <path
              key={n.id}
              d={`M 800 ${y1} C 913 ${y1}, 913 ${outY[i]}, 1026 ${outY[i]}`}
              fill="none"
              stroke={n.calls ? "var(--color-critical-solid)" : "var(--color-border-strong)"}
              strokeOpacity={n.calls ? 0.85 : 1}
              strokeWidth={width(n.calls)}
              strokeDasharray={n.calls ? undefined : "4 4"}
            />
          );
        })}
      </svg>
      <span className="absolute top-0 text-caption text-text-secondary" style={{ left: pct(330) }}>
        In
      </span>
      <span className="absolute top-0 text-caption text-text-secondary" style={{ left: pct(880) }}>
        Out
      </span>
      {flow.in.map((n, i) => (
        <FlowBox key={n.id} node={n} style={{ left: 0, top: inY[i] - 26, width: pct(280) }} />
      ))}
      <FlowBox node={flow.sim} style={{ left: pct(500), top: simTop + 8, width: pct(300) }} />
      {flow.out.map((n, i) => (
        <FlowBox key={n.id} node={n} style={{ left: pct(1026), top: outY[i] - 26, width: pct(280) }} />
      ))}
    </div>
  );
}

function FlowBox({ node, style }: { node: Pick<FlowNode, "label" | "detail">; style: React.CSSProperties }) {
  return (
    <div className="absolute flex h-[52px] flex-col justify-center rounded-lg border border-border-default bg-surface-raised px-3" style={style}>
      <span className="truncate text-body-s text-text-primary">{node.label}</span>
      <span className="truncate text-caption text-text-secondary">{node.detail}</span>
    </div>
  );
}

/** G35–G38 · Number trace (SIM box): ready (G35), tracing (G36), no calls (G37), partial data (G38). */
export default function TracePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const now = useNow(60_000);
  // Poll until the trace is ready or has no calls.
  const { data } = useApi<Trace>(`/traces/${id}`, { refreshInterval: (t) => (t?.status === "running" ? 1500 : 0) });
  const [starting, setStarting] = useState(false);
  const period = data?.period ?? params.get("period") ?? "24h";
  const running = !data || data.status === "running";
  const ready = data?.status === "ready";
  const hourly = data?.hourly_calls ?? [];
  const known = hourly.filter((v): v is number => v !== null);
  const max = Math.max(70, ...known);
  // Missing hours are drawn grey at the usual level, so the gap reads as “not in yet”, not “no calls”.
  const usual = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
  const flow = ready && data.flow ? flowNodes(data.flow) : null;
  const totalHours = data?.gaps ? data.gaps.covered_hours + data.gaps.missing_hours.length : 24;

  // A trace covers one period; another period is a new trace.
  const setPeriod = async (p: string) => {
    if (!data) return;
    setStarting(true);
    try {
      const res = await apiFetch<{ id: string }>("POST", "/traces", { subscriber_id: data.subject.subscriber_id, period: p, case_id: data.case_id ?? undefined });
      router.push(`/trace/${res.id}?${new URLSearchParams({ period: p })}`, { scroll: false });
    } catch {
      toast({ title: "Couldn’t start the trace", body: "Nothing changed. Try again." });
    } finally {
      setStarting(false);
    }
  };
  const exportTrace = () => toast({ tone: "success", title: "Trace exported", body: `${id}.pdf · numbers masked · logged to the audit trail` });

  const badge = running ? (
    <Badge label="Tracing" tone="info" size="md" />
  ) : data?.status === "no_calls" ? (
    <Badge label="No calls" tone="neutral" size="md" />
  ) : (
    <Badge label={VERDICT_BADGE[data.verdict?.kind ?? ""] ?? "Trace ready"} tone={data.verdict?.kind === "sim_box" ? "critical" : "neutral"} size="md" />
  );
  const hourlyNote =
    data?.verdict?.kind !== "sim_box"
      ? ""
      : data.gaps
        ? `Light bars: ${FEED[data.gaps.feed] ?? data.gaps.feed} records not in yet. The rest is flat all day and night; people don’t call like this.`
        : "Flat all day and night. People don’t call like this.";
  const covered = data?.gaps ? `${data.gaps.covered_hours} of ${totalHours} hours` : (PERIOD[period] ?? period);
  const doneSteps = data?.steps?.filter((s) => s.state === "done").length ?? 0;

  return (
    <>
      <AppHeader section={`Subscriber lookup / ${data?.subject.msisdn ?? ""}`} title="Terminating number trace" />
      <PageBody>
        <PageHead
          title="Where this SIM’s calls end up"
          pill={badge}
          subtitle={`${data ? localMsisdn(data.subject.msisdn) : "…"} · call records (CDRs) for the ${PERIOD[period] ?? period}`}
          actions={
            data?.status === "no_calls" ? undefined : (
              <>
                <Button variant="danger-outline" size="md" disabled={!ready || !data?.case_id} onClick={() => router.push(`/cases/${data?.case_id}?protect=1`)}>
                  Suspend SIM
                </Button>
                {data?.case_id ? (
                  <ButtonLink href={`/cases/${data.case_id}`} size="md" aria-disabled={!ready} className={cn(!ready && "pointer-events-none opacity-50")}>
                    Open case {data.case_id}
                  </ButtonLink>
                ) : (
                  <Button size="md" disabled>
                    Open case
                  </Button>
                )}
              </>
            )
          }
        />

        {data?.status === "no_calls" ? (
          /* G37 · No calls. */
          <EmptyState
            icon="app/icon-phone-secondary-18"
            title={`No calls from this SIM in the ${PERIOD[period]}`}
            actions={
              <>
                <Button
                  variant="secondary"
                  size="md"
                  // TODO(api): no SMS trace endpoint yet.
                  onClick={() => toast({ title: "SMS traces aren’t available yet", body: "Check the subscriber’s activity tab for SMS and data use." })}
                >
                  Check SMS instead
                </Button>
                <Button size="md" loading={starting} onClick={() => setPeriod("7d")}>
                  Trace last 7 days
                </Button>
              </>
            }
          >
            There’s nothing to trace yet. Try a longer period, or check whether this SIM sends SMS or uses data instead.
          </EmptyState>
        ) : (
          <>
            {/* G38 · Partial data. */}
            {data?.gaps && (
              <Banner
                tone="warning"
                icon="app/icon-alert-triangle-medium-16"
                title={`Missing ${plural(data.gaps.missing_hours.length, "hour")} of ${FEED[data.gaps.feed] ?? data.gaps.feed} records`}
              >
                The {FEED[data.gaps.feed] ?? data.gaps.feed} feed is delayed since {formatClock(data.gaps.delayed_since)}, so this trace covers {data.gaps.covered_hours} of{" "}
                {totalHours} hours. Figures update when the records arrive.
              </Banner>
            )}
            {ready && data.verdict && (
              <Banner tone="error" icon="app/icon-alert-circle-critical-14" title={data.verdict.title}>
                {data.verdict.detail}
              </Banner>
            )}

            <Card
              title={`Call flow · ${covered}`}
              aside={
                ready ? (
                  <span className="flex items-center gap-4">
                    <CardMeta>Line thickness = number of calls</CardMeta>
                    <button type="button" onClick={exportTrace} className="flex h-8 items-center rounded text-label-s text-text-brand hover:underline">
                      Export trace
                    </button>
                  </span>
                ) : undefined
              }
            >
              {flow ? (
                <Flow flow={flow} />
              ) : (
                /* G36 · Tracing. */
                <div className="flex flex-col gap-3" aria-live="polite">
                  <div className="flex flex-col gap-2">
                    <span className="h-1.5 max-w-[486px] rounded-full bg-surface-sunken">
                      <span className="block h-1.5 rounded-full bg-brand-primary transition-[width]" style={{ width: `${data?.progress_pct ?? 5}%` }} />
                    </span>
                    <span className="text-caption text-text-secondary">{data?.progress_pct ?? 0}%</span>
                  </div>
                  <ol className="flex flex-col gap-1">
                    {data?.steps?.map((s, i) => (
                      <li
                        key={s.id}
                        className={cn("flex items-center gap-2.5 rounded-lg border px-1.5 py-1.5", s.state === "running" ? "border-border-default" : "border-transparent")}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-caption",
                            s.state === "done"
                              ? "bg-brand-primary-subtle"
                              : s.state === "running"
                                ? "bg-brand-primary text-text-inverse"
                                : "border border-border-strong text-text-secondary",
                          )}
                        >
                          {s.state === "done" ? <Icon name="app/icon-check-brand-22" size={12} /> : i + 1}
                        </span>
                        <span className={cn("text-body-s", s.state === "waiting" ? "text-text-secondary" : "text-text-primary")}>
                          {STEP[s.id]?.label ?? s.id.replace(/_/g, " ")} · {STEP[s.id]?.detail(s) ?? `${n(s.done)} done`}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <span className="sr-only">{doneSteps} steps done</span>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-5">
              {ready && hourly.length ? (
                <Card title="Calls out per hour">
                  <div className="relative h-[90px] pl-7">
                    {[0, 35, 70].map((v) => (
                      <span key={v} className="absolute -translate-y-1/2 text-caption text-text-secondary" style={{ left: 0, top: `${100 - (v / max) * 100}%` }}>
                        {v}
                      </span>
                    ))}
                    <div className="relative flex h-full items-end gap-1 border-b border-border-default">
                      {hourly.map((v, h) => {
                        const gap = v === null || data.gaps?.missing_hours.includes(h);
                        return (
                          <span
                            key={h}
                            title={gap ? `${String(h).padStart(2, "0")}:00 · records not in yet` : `${String(h).padStart(2, "0")}:00 · ${v} calls`}
                            className={cn("flex-1 rounded-t-[2px]", gap ? "bg-surface-raised" : "bg-neutral-fg")}
                            style={{ height: `${((v ?? usual) / max) * 100}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="-mt-2 flex justify-between pl-7 text-caption text-text-secondary">
                    {["00", "06", "12", "18", "23"].map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  {hourlyNote && <p className="text-caption text-text-secondary">{hourlyNote}</p>}
                </Card>
              ) : (
                <Card>
                  <div className="flex flex-col gap-3" aria-busy>
                    <Skeleton className="h-3.5 w-1/5" />
                    <Skeleton className="mt-3 h-2.5 w-1/2" />
                    <Skeleton className="h-2.5 w-2/5" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </Card>
              )}
              {ready && data.signs ? (
                <Card title="Tell-tale signs">
                  <div className="grid grid-cols-2 gap-2.5">
                    {signTiles(data.signs, now).map((t) => (
                      <div key={t.label} className="flex flex-col gap-1 rounded-lg border border-border-default bg-surface-raised px-3.5 py-3">
                        <span className="text-caption text-text-secondary">{t.label}</span>
                        <span className="text-h2 text-text-primary">{t.value}</span>
                        <span className="text-caption text-text-secondary">{t.sub}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="flex flex-col gap-3" aria-busy>
                    <Skeleton className="h-3.5 w-1/5" />
                    <Skeleton className="mt-3 h-2.5 w-1/2" />
                    <Skeleton className="h-2.5 w-2/5" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
