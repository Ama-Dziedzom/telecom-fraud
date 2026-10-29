"use client";

import { DocHeader, PrintDocument, Section, formatStamp } from "@/components/print/PrintDocument";
import { PERIOD, type Trace } from "@/components/subscriber/TraceBody";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import { useParams } from "next/navigation";

const n = (v: number) => v.toLocaleString("en-GB");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
const SOURCE: Record<string, string> = { international: "International route", local: "Local numbers" };
const FEED: Record<string, string> = { interconnect: "interconnect", cdr: "call record" };

/** A box in the call flow. */
function Box({ label, detail, tone }: { label: string; detail: string; tone?: "critical" | "brand" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 break-inside-avoid",
        tone === "critical" ? "border-critical-border bg-critical-bg" : tone === "brand" ? "border-text-primary bg-surface-sunken" : "border-border-default",
      )}
    >
      <p className={cn("text-label-s", tone === "critical" ? "text-critical-fg" : "text-text-primary")}>{label}</p>
      <p className="text-caption text-text-secondary">{detail}</p>
    </div>
  );
}

/** G35 · Number trace · PDF — the verdict, where the calls come from and go, the hourly pattern and the tell-tale signs. */
export default function TracePdfPage() {
  const { id } = useParams<{ id: string }>();
  const { data: t, error } = useApi<Trace>(`/traces/${id}`, { refreshInterval: (d) => (d?.status === "running" ? 1500 : 0) });

  if (error) return <p className="p-10 text-body-m text-text-secondary">We couldn’t load trace {id}. Go back and try again.</p>;

  return (
    <PrintDocument kind="Number trace" reference={id} fileName={`${id}-number-trace`} ready={!!t && t.status !== "running"}>
      {({ by, at, operator }) => {
        if (!t) return null;
        const period = PERIOD[t.period] ?? t.period;
        const hourly = t.hourly_calls ?? [];
        const max = Math.max(1, ...hourly.map((v) => v ?? 0));
        const missing = new Set(t.gaps?.missing_hours ?? []);
        const known = hourly.filter((v): v is number => v !== null);
        return (
          <div className="flex flex-col gap-5">
            <DocHeader kind="Number trace" reference={t.id} operator={operator} by={by} at={at} form={`CDRs and interconnect feeds · ${period}`} />

            <div className="flex flex-col gap-1">
              <h1 className="text-h1 text-text-primary">Where {t.subject.msisdn}’s calls end up</h1>
              <p className="text-body-m text-text-secondary">
                {t.status === "no_calls" ? "No calls" : `${plural(t.flow?.sim.calls_out ?? 0, "call")} out`} in the {period}
                {t.case_id ? ` · for ${t.case_id}` : ""}
              </p>
            </div>

            {t.verdict && (
              <div className="flex flex-col gap-0.5 rounded-md border border-critical-border bg-critical-bg px-3 py-2 break-inside-avoid">
                <p className="text-label-m text-critical-fg">{t.verdict.title}</p>
                <p className="text-body-s text-text-primary">{t.verdict.detail}</p>
              </div>
            )}
            {t.gaps && (
              <div className="rounded-md border border-medium-border bg-medium-bg px-3 py-2 text-caption text-medium-fg break-inside-avoid">
                <span className="font-medium">
                  Missing {plural(t.gaps.missing_hours.length, "hour")} of {FEED[t.gaps.feed] ?? t.gaps.feed} records.
                </span>{" "}
                The feed has been delayed since {formatClock(t.gaps.delayed_since)}, so this trace covers {t.gaps.covered_hours} of {t.gaps.covered_hours + t.gaps.missing_hours.length} hours.
              </div>
            )}

            {t.status === "no_calls" ? (
              <Section letter="A" title="Calls">
                <p className="text-body-s text-text-secondary">This SIM made no calls in the {period}, so there is nothing to trace. A SIM box makes hundreds a day.</p>
              </Section>
            ) : (
              <>
                {t.flow && (
                  <Section letter="A" title="Call flow" aside="Calls in → this SIM → calls out" className="break-inside-avoid">
                    <div className="grid grid-cols-[1fr_16px_1fr_16px_1fr] items-center gap-2">
                      <div className="flex flex-col gap-2">
                        {t.flow.in.map((f) => (
                          <Box key={f.source} label={SOURCE[f.source] ?? f.source} detail={`${n(f.calls)} calls in`} tone={f.source === "international" ? "critical" : undefined} />
                        ))}
                      </div>
                      <span className="text-center text-text-tertiary">→</span>
                      <Box label="This SIM" detail={`${n(t.flow.sim.calls_out)} calls out · ${plural(t.flow.sim.cells, "cell")}`} tone="brand" />
                      <span className="text-center text-text-tertiary">→</span>
                      <div className="flex flex-col gap-2">
                        {t.flow.out.map((o) => (
                          <Box
                            key={o.operator.id}
                            label={`${o.operator.name} numbers`}
                            detail={`${n(o.numbers)}${o.lower_bound ? "+" : ""} numbers · ${n(o.calls)}${o.lower_bound ? "+" : ""} calls`}
                          />
                        ))}
                        <Box label="Contacts who call back" detail={t.flow.call_backs.numbers ? `${plural(t.flow.call_backs.numbers, "number")} · ${plural(t.flow.call_backs.calls, "call")}` : "None"} />
                      </div>
                    </div>
                  </Section>
                )}

                {hourly.length > 0 && (
                  <Section letter="B" title="Calls out by hour" aside={t.gaps ? `${t.gaps.covered_hours} of 24 hours` : "00:00–23:59, Ghana time"} className="break-inside-avoid">
                    <div className="flex h-28 items-end gap-1 border-b border-text-primary">
                      {hourly.map((v, h) => (
                        <div key={h} className="flex flex-1 flex-col items-center justify-end gap-0.5 self-stretch">
                          {v !== null && !missing.has(h) && <span className="text-[9px] leading-3 text-text-tertiary tabular-nums">{v}</span>}
                          <span
                            className={cn("w-full rounded-t-[2px]", v === null || missing.has(h) ? "border border-dashed border-border-strong" : "bg-text-primary")}
                            style={{ height: v === null || missing.has(h) ? "100%" : `${(v / max) * 85}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 font-mono text-[9px] leading-3 text-text-tertiary">
                      {hourly.map((_, h) => (
                        <span key={h} className="flex-1 text-center">
                          {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                        </span>
                      ))}
                    </div>
                    <p className="text-caption text-text-secondary">
                      {known.length ? `${Math.min(...known)}–${Math.max(...known)} calls every hour, day and night. ` : ""}
                      {t.gaps ? "Dashed: records not in yet. " : ""}
                      {t.verdict?.kind === "sim_box" ? "People don’t call like this; a machine does." : ""}
                    </p>
                  </Section>
                )}

                {t.signs && (
                  <Section letter="C" title="Tell-tale signs" className="break-inside-avoid">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: `${t.signs.avg_call_seconds} s`, label: "Average call", sub: "People average 2–3 min" },
                        { value: n(t.signs.cells_used), label: "Cells it uses", sub: t.signs.cells_used === 1 ? "It never moves" : "It moves around" },
                        { value: n(t.signs.call_backs), label: "Calls back", sub: t.signs.call_backs ? "Some people call it" : "Nobody calls it" },
                        { value: plural(t.signs.sim_age_days, "day"), label: "SIM age", sub: `Activated ${new Date(at - t.signs.sim_age_days * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` },
                      ].map((s) => (
                        <div key={s.label} className="rounded-md border border-border-default px-3 py-2">
                          <p className="text-caption text-text-secondary">{s.label}</p>
                          <p className="text-h3 text-text-primary tabular-nums">{s.value}</p>
                          <p className="text-caption text-text-secondary">{s.sub}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}

            <footer className="flex flex-col gap-1 border-t-2 border-text-primary pt-2 text-caption text-text-secondary break-inside-avoid">
              <p>Made by FraudDetection from call records at {formatStamp(at)}. Numbers called are counted, never listed.</p>
              <p>Phone numbers are masked. This copy carries {by}’s name and the export is logged in the audit trail. Don’t forward it outside {operator}.</p>
            </footer>
          </div>
        );
      }}
    </PrintDocument>
  );
}
