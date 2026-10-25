"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Card, Skeleton } from "@/components/app/Card";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type FlowNode = { id: string; label: string; detail: string; calls: number; tone?: string; icon: string };
type Trace = {
  id: string;
  subject: { msisdn: string; period: string };
  status: "running" | "ready" | "no_calls";
  progress_pct?: number;
  steps?: Array<{ label: string; detail: string; state: "done" | "running" | "waiting" }>;
  verdict?: { kind: string; title: string; detail: string };
  flow?: { in: FlowNode[]; sim: { label: string; detail: string }; out: FlowNode[] };
  hourly?: number[];
  hourly_note?: string;
  signs?: Array<{ value: string; label: string; tone: "high" | "critical" }>;
  case_id?: string;
  gaps?: { title: string; detail: string; missing_hours: number[] } | null;
};

const W = 1306;
const H = 300;
const ICON: Record<string, string> = { globe: "app/icon-globe-high-18", phone: "app/icon-phone-brand-18", users: "app/icon-users-brand-18" };
const PERIOD: Record<string, string> = { "24h": "last 24 hours", "7d": "last 7 days" };

/** G35 · In → this SIM → out, ribbon thickness = number of calls. */
function Flow({ flow }: { flow: NonNullable<Trace["flow"]> }) {
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
              stroke={n.tone === "high" ? "#d9825a" : "#a99cf2"}
              strokeOpacity={0.8}
              strokeWidth={width(n.calls)}
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
              stroke={n.calls ? "#d56b6b" : "#d4d4d4"}
              strokeOpacity={n.calls ? 0.85 : 0.6}
              strokeWidth={width(n.calls)}
            />
          );
        })}
      </svg>
      <span className="absolute top-2 text-overline text-text-tertiary uppercase" style={{ left: pct(330) }}>
        In
      </span>
      <span className="absolute top-2 text-overline text-text-tertiary uppercase" style={{ left: pct(880) }}>
        Out
      </span>
      {flow.in.map((n, i) => (
        <FlowBox key={n.id} node={n} style={{ left: 0, top: inY[i] - 32, width: pct(280) }} tone={n.tone === "high" ? "high" : "raised"} />
      ))}
      <div className="absolute flex h-[84px] items-center gap-2.5 rounded-xl border border-critical-border bg-critical-bg px-3.5" style={{ left: pct(500), top: simTop, width: pct(300) }}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-critical-bg">
          <Icon name="app/icon-sim-critical-18" size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-label-m text-text-primary">{flow.sim.label}</span>
          <span className="truncate font-mono text-mono-s text-text-secondary">{flow.sim.detail}</span>
        </span>
      </div>
      {flow.out.map((n, i) => (
        <FlowBox key={n.id} node={n} style={{ left: pct(1026), top: outY[i] - 32, width: pct(280) }} tone="raised" />
      ))}
    </div>
  );
}

function FlowBox({ node, style, tone }: { node: FlowNode; style: React.CSSProperties; tone: "high" | "raised" }) {
  return (
    <div
      className={cn("absolute flex h-16 items-center gap-2.5 rounded-xl border px-3.5", tone === "high" ? "border-high-border bg-high-bg" : "border-border-subtle bg-surface-raised")}
      style={style}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", tone === "high" ? "bg-high-bg" : "bg-brand-primary-subtle")}>
        <Icon name={ICON[node.icon]} size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-label-m text-text-primary">{node.label}</span>
        <span className="truncate font-mono text-mono-s text-text-secondary">{node.detail}</span>
      </span>
    </div>
  );
}

/** G35–G38 · Terminating number trace — where a SIM’s calls come from and end up. */
export default function TracePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const period = params.get("period") ?? "24h";
  const qs = new URLSearchParams({ period });
  if (params.get("demo")) qs.set("demo", params.get("demo")!);
  // TODO(api): proposed POST /traces + GET /traces/{id}.
  const { data } = useApi<Trace>(`/traces/${id}?${qs}`, { refreshInterval: (t) => (t?.status === "running" ? 1500 : 0) });
  const running = !data || data.status === "running";
  const ready = data?.status === "ready";
  const max = Math.max(70, ...(data?.hourly ?? [0]));

  const setPeriod = (p: string) => router.push(`/trace/${id}?${new URLSearchParams({ ...Object.fromEntries(qs), period: p })}`, { scroll: false });
  const exportTrace = () => toast({ tone: "success", title: "Trace exported", body: `${id}.pdf · numbers masked · logged to the audit trail` });

  const badge = running ? <Badge label="Tracing…" tone="info" dot /> : data?.status === "no_calls" ? <Badge label="No calls" tone="neutral" dot /> : <Badge label="SIM box suspected" tone="critical" dot />;

  return (
    <>
      <AppHeader section={`Subscriber lookup / ${data?.subject.msisdn ?? ""}`} title="Terminating number trace" />
      <PageBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2.5 text-h2 text-text-primary">
              Where this SIM’s calls end up
              {badge}
            </h2>
            <p className="text-body-s text-text-secondary">
              {data?.subject.msisdn ?? "…"} · call records (CDRs) for the {PERIOD[period] ?? period}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="md" disabled={running} onClick={() => setPeriod(period === "24h" ? "7d" : "24h")} iconLeft={<Icon name="app/icon-clock-secondary-18" size={18} />}>
              Change period
            </Button>
            <Button variant="secondary" size="md" disabled={!ready} onClick={exportTrace} iconLeft={<Icon name="app/icon-download-18" size={18} />}>
              Export trace
            </Button>
            {data?.status !== "no_calls" && (
              <ButtonLink href={`/cases/${data?.case_id ?? ""}`} size="md" aria-disabled={!ready} className={cn(!ready && "pointer-events-none opacity-50")}>
                Open case {data?.case_id ?? "FD-3061"}
              </ButtonLink>
            )}
          </div>
        </div>

        {data?.status === "no_calls" ? (
          <EmptyState
            icon="app/icon-phone-18"
            tone="neutral"
            title={`No calls from this SIM in the ${PERIOD[period]}`}
            className="min-h-[200px] py-10"
            actions={
              <>
                <Button size="md" onClick={() => setPeriod("7d")} iconLeft={<Icon name="app/icon-clock-white-20" size={18} />}>
                  Trace last 7 days
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  // TODO(api): no SMS trace endpoint yet.
                  onClick={() => toast({ title: "SMS traces aren’t available yet", body: "Check the subscriber’s activity tab for SMS and data use." })}
                  iconLeft={<Icon name="app/icon-message-18" size={18} />}
                >
                  Check SMS instead
                </Button>
              </>
            }
          >
            There’s nothing to trace yet. Try a longer period, or check whether this SIM sends SMS or uses data instead.
          </EmptyState>
        ) : (
          <>
            {data?.gaps && (
              <Banner tone="warning" title={data.gaps.title}>
                {data.gaps.detail}
              </Banner>
            )}
            {ready && data.verdict && (
              <section className="flex items-center gap-4 rounded-xl border border-critical-border bg-critical-bg px-5 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-surface-base">
                  <Icon name="app/icon-server-critical-22" size={22} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-h3 text-critical-fg">{data.verdict.title}</span>
                  <span className="text-body-m text-text-secondary">{data.verdict.detail}</span>
                </span>
                <Button variant="danger" size="md" onClick={() => router.push(`/cases/${data.case_id}?protect=1`)} iconLeft={<Icon name="app/icon-ban-white-18" size={18} />}>
                  Suspend SIM
                </Button>
              </section>
            )}

            <Card title={`Call flow · ${PERIOD[period] ?? period}`} icon="app/icon-network-secondary-18" aside={ready ? <Badge label="Line thickness = number of calls" tone="neutral" /> : undefined}>
              {ready && data.flow ? (
                <Flow flow={data.flow} />
              ) : (
                <div className="flex flex-col gap-4 py-2" aria-live="polite">
                  <div className="flex items-center gap-4">
                    <span className="h-2 max-w-[680px] flex-1 rounded-full bg-surface-sunken">
                      <span className="block h-2 rounded-full bg-brand-primary transition-[width]" style={{ width: `${data?.progress_pct ?? 5}%` }} />
                    </span>
                    <span className="text-caption text-text-secondary">{data?.progress_pct ?? 0}%</span>
                  </div>
                  {data?.steps?.map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className={cn("flex size-7 items-center justify-center rounded-lg", s.state === "done" ? "bg-success-bg" : s.state === "running" ? "bg-brand-primary-subtle" : "bg-surface-sunken")}>
                        <Icon
                          name={s.state === "done" ? "app/icon-check-success-16" : s.state === "running" ? "app/icon-refresh-brand-22" : "app/icon-circle-dashed-16"}
                          size={14}
                          className={s.state === "running" ? "animate-spin [animation-duration:2s]" : undefined}
                        />
                      </span>
                      <span className="flex flex-col">
                        <span className={cn("text-label-m", s.state === "waiting" ? "text-text-secondary" : "text-text-primary")}>{s.label}</span>
                        <span className="text-caption text-text-secondary">{s.detail}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card title="Calls out per hour" icon="app/icon-clock-secondary-18">
                {ready && data.hourly ? (
                  <>
                    <div className="relative h-[110px] pl-8">
                      {[0, 35, 70].map((v) => (
                        <span key={v} className="absolute right-0 left-8 h-px bg-border-subtle" style={{ bottom: `${(v / max) * 100}%` }}>
                          <span className="absolute -left-8 -translate-y-1/2 font-mono text-mono-s text-text-tertiary">{v}</span>
                        </span>
                      ))}
                      <div className="relative flex h-full items-end gap-1">
                        {data.hourly.map((v, h) => {
                          const gap = data.gaps?.missing_hours.includes(h);
                          return (
                            <span
                              key={h}
                              title={gap ? `${String(h).padStart(2, "0")}:00 · records not in yet` : `${String(h).padStart(2, "0")}:00 · ${v} calls`}
                              className={cn("flex-1 rounded-t-[2px]", gap ? "bg-surface-sunken" : "bg-critical-fg")}
                              style={{ height: `${(v / max) * 100}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-between pl-8 font-mono text-mono-s text-text-tertiary">
                      {["00", "06", "12", "18", "23"].map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <p className="text-caption text-text-secondary">{data.hourly_note}</p>
                  </>
                ) : (
                  <div className="flex flex-col gap-3" aria-busy>
                    <Skeleton className="h-[64px] w-3/4 rounded-lg" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                )}
              </Card>
              <Card title="Tell-tale signs" icon="app/icon-alert-triangle-secondary-18">
                {ready && data.signs ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {data.signs.map((s) => (
                      <div key={s.label} className={cn("flex flex-col gap-0.5 rounded-[10px] px-3.5 py-3", s.tone === "critical" ? "bg-critical-bg" : "bg-high-bg")}>
                        <span className={cn("text-h3", s.tone === "critical" ? "text-critical-fg" : "text-high-fg")}>{s.value}</span>
                        <span className="text-caption text-text-secondary">{s.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3" aria-busy>
                    <Skeleton className="h-[64px] w-3/4 rounded-lg" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
