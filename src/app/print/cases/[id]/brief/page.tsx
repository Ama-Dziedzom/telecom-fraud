"use client";

import { DocHeader, PrintDocument, formatStamp } from "@/components/print/PrintDocument";
import { Badge } from "@/components/ui/Badge";
import { useCase, type Outcome } from "@/lib/api/cases";
import { useApi, type Money, type PersonRef, type Severity } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

type Fact = { kind: string; title: string; detail: string };
type Visual =
  | { kind: "agent_swaps"; agent: { code: string; name: string; area: string; agent_since: string }; facts: Fact[]; by_day: Array<{ date: string; count: number }> }
  | { kind: "two_phones"; distance_km: number; phones: Array<{ model: string; place: string; usual: boolean; used_months: number; event: string; at: string }>; facts: Fact[] }
  | { kind: "transfers"; title: string; subtitle: string; limit: Money; bars: Array<{ at: string; amount: Money }>; balance: { from: Money; to: Money } }
  | {
      kind: "flow";
      title: string;
      subtitle: string;
      source: { msisdn: string };
      destinations: Array<{ kind: "wallet" | "agent"; identifier: string; amount: Money; case_id: string | null; cashed_out: boolean }>;
    }
  | { kind: "actions"; title: string; items: Array<{ kind: string; title: string; actor: PersonRef | null; at: string; detail: string | null }> }
  | { kind: "standing"; tiles: Array<{ kind: string; amount: Money }>; next: Array<{ done: boolean; title: string; at: string | null; by: PersonRef | null; due_at: string | null }> };

type Chapter = {
  number: number;
  /** null on the last chapter: where it stands now. */
  at: string | null;
  short: string;
  title: string;
  summary: string;
  stats: Array<{ value: string; label: string; severity: Severity | null }>;
  visual: Visual;
};

/** GET /cases/{id}/brief: the case as a short story, for the Head of Fraud. */
type Brief = { case_id: string; status: "ready"; outcome: Outcome; outcome_state: "proposed" | "decided"; generated_at: string; chapters: Chapter[] };

const money = (m: Money) => formatMoney(m.amount_minor, m.currency);
const OUTCOME: Record<Outcome, string> = { confirmed_fraud: "Confirmed fraud", false_positive: "False positive", inconclusive: "Inconclusive" };
const TILE: Record<string, string> = { taken: "Taken", kept_by_freeze: "Kept by the freeze", held_for_reversal: "Held for reversal" };
const STAT_TONE: Partial<Record<Severity, string>> = { critical: "text-critical-fg", high: "text-high-fg", low: "text-success-fg" };

function Facts({ facts }: { facts: Fact[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {facts.map((f) => (
        <li key={f.kind} className="flex gap-2 break-inside-avoid">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-critical-solid" />
          <span>
            <span className="block text-label-s text-text-primary">{f.title}</span>
            <span className="text-caption text-text-secondary">{f.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Bars with a label on top and under; `hot` bars are red. */
function Bars({ bars, height = 112, limit }: { bars: Array<{ value: number; top: string; bottom: string; hot?: boolean }>; height?: number; limit?: { value: number; label: string } }) {
  const max = Math.max(1, limit?.value ?? 0, ...bars.map((b) => b.value));
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-end gap-2 border-b border-text-primary" style={{ height }}>
        {limit && (
          <div className="absolute inset-x-0 border-t border-dashed border-critical-solid" style={{ bottom: `${(limit.value / max) * 88}%` }}>
            <span className="absolute -top-4 right-0 bg-surface-base px-1 text-[10px] leading-4 text-critical-fg">{limit.label}</span>
          </div>
        )}
        {bars.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5 self-stretch">
            <span className={cn("text-[10px] leading-3 tabular-nums", b.hot ? "text-critical-fg" : "text-text-secondary")}>{b.top}</span>
            <span className={cn("w-full rounded-t-[2px]", b.hot ? "bg-critical-solid" : "bg-text-primary")} style={{ height: `${(b.value / max) * 88}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 font-mono text-[10px] leading-3 text-text-tertiary">
        {bars.map((b, i) => (
          <span key={i} className="flex-1 text-center">
            {b.bottom}
          </span>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, sub, children }: { title?: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-default p-4 break-inside-avoid">
      {title && (
        <div>
          <p className="text-label-m text-text-primary">{title}</p>
          {sub && <p className="text-caption text-text-secondary">{sub}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function ChapterVisual({ v }: { v: Visual }) {
  switch (v.kind) {
    case "agent_swaps":
      return (
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <Panel title={`${v.agent.code} · ${v.agent.name}`} sub={`${v.agent.area} · agent since ${new Date(v.agent.agent_since).getFullYear()}`}>
            <Bars
              bars={v.by_day.map((d, i) => ({
                value: d.count,
                top: String(d.count),
                bottom: new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" }),
                hot: i === v.by_day.length - 1,
              }))}
            />
            <p className="text-caption text-text-secondary">SIM swaps a day, last {v.by_day.length} days</p>
          </Panel>
          <Facts facts={v.facts} />
        </div>
      );
    case "two_phones":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {v.phones.flatMap((p, i) => [
              i === 1 && (
                <span key="gap" className="text-center text-caption text-text-secondary">
                  {v.distance_km} km
                  <br />→
                </span>
              ),
              <div key={p.model} className={cn("rounded-md border px-3 py-2", p.usual ? "border-border-default" : "border-critical-border bg-critical-bg")}>
                  <p className="text-caption text-text-secondary">{p.usual ? `His phone · ${p.used_months} months` : "Never used before"}</p>
                  <p className="text-label-m text-text-primary">{p.model}</p>
                  <p className="text-caption text-text-secondary">
                    {p.place} · {p.event === "went_silent" ? "went silent" : "signed in"} {formatClock(p.at)}
                  </p>
              </div>,
            ])}
          </div>
          <Facts facts={v.facts} />
        </div>
      );
    case "transfers":
      return (
        <Panel title={v.title} sub={v.subtitle}>
          <Bars
            height={140}
            limit={{ value: v.limit.amount_minor, label: `Limit ${money(v.limit)}` }}
            bars={v.bars.map((b) => ({ value: b.amount.amount_minor, top: money(b.amount).replace("GHS ", ""), bottom: formatClock(b.at), hot: true }))}
          />
          <p className="text-caption text-text-secondary">
            Wallet balance {money(v.balance.from)} → {formatMoney(v.balance.to.amount_minor, v.balance.to.currency, { decimals: true })}
          </p>
        </Panel>
      );
    case "flow":
      return (
        <Panel title={v.title} sub={v.subtitle}>
          <table className="w-full border-collapse text-caption">
            <thead>
              <tr>
                {["From " + v.source.msisdn, "Amount", "Now", "Case"].map((h, i) => (
                  <th key={h} className={cn("border-b border-text-primary py-1 text-left text-overline font-bold text-text-secondary uppercase", i === 1 && "text-right", i === 2 && "pl-4")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.destinations.map((d) => (
                <tr key={d.identifier} className="border-b border-border-subtle">
                  <td className="py-1.5">
                    {d.identifier}
                    <span className="block text-text-secondary">{d.kind === "agent" ? "Agent cash-out" : "Wallet he had never paid"}</span>
                  </td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{money(d.amount)}</td>
                  <td className={cn("py-1.5 pl-4", d.cashed_out ? "text-critical-fg" : "text-text-secondary")}>{d.cashed_out ? "Cashed out" : "Still in the wallet"}</td>
                  <td className="py-1.5 font-mono text-[11px]">{d.case_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      );
    case "actions":
      return (
        <Panel title={v.title}>
          <ol className="flex flex-col">
            {v.items.map((a, i) => (
              <li key={a.kind} className="grid grid-cols-[14mm_12px_1fr] gap-x-2">
                <span className="font-mono text-[11px] leading-4 text-text-secondary">{formatClock(a.at)}</span>
                <span className="flex flex-col items-center">
                  <span className="mt-1 size-2 rounded-full bg-success-solid" />
                  {i < v.items.length - 1 && <span className="w-px flex-1 bg-border-default" />}
                </span>
                <div className="pb-3">
                  <p className="text-label-s text-text-primary">{a.title}</p>
                  <p className="text-caption text-text-secondary">{[a.actor?.name, a.detail].filter(Boolean).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      );
    case "standing":
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {v.tiles.map((t) => (
              <div key={t.kind} className="rounded-md border border-border-default px-3 py-2">
                <p className="text-caption text-text-secondary">{TILE[t.kind] ?? t.kind}</p>
                <p className={cn("text-h3 tabular-nums", t.kind === "taken" ? "text-critical-fg" : "text-text-primary")}>
                  {formatMoney(t.amount.amount_minor, t.amount.currency, { decimals: t.amount.amount_minor % 100 !== 0 })}
                </p>
              </div>
            ))}
          </div>
          <Panel title="What’s done and what’s left">
            <ul className="flex flex-col gap-2">
              {v.next.map((s) => (
                <li key={s.title} className="flex items-start gap-2">
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]", s.done ? "border-success-solid bg-success-solid text-text-inverse" : "border-border-strong")}>
                    {s.done ? "✓" : ""}
                  </span>
                  <span>
                    <span className="block text-label-s text-text-primary">{s.title}</span>
                    <span className="text-caption text-text-secondary">
                      {s.done ? `${s.by?.name ?? ""}, ${formatClock(s.at!)}` : [s.by?.name, s.due_at && `due ${formatStamp(s.due_at)}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      );
  }
}

/** Case brief · PDF — the case as six short chapters, one a page, for the Head of Fraud (I4) and anyone signing off. */
export default function CaseBriefPage() {
  const { id } = useParams<{ id: string }>();
  const { data: brief, error } = useApi<Brief>(`/cases/${id}/brief`, { refreshInterval: (b) => (b && b.status !== "ready" ? 3000 : 0) });
  const { data: c } = useCase(id);
  const ready = brief?.status === "ready" && !!c;

  if (error) return <p className="p-10 text-body-m text-text-secondary">We couldn’t make the brief for {id}. Go back to the case and try again.</p>;

  return (
    <PrintDocument kind="Case brief" reference={id} fileName={`${id}-brief`} ready={ready}>
      {({ by, at, operator }) => {
        if (!brief || !c) return null;
        return (
          <div className="flex flex-col">
            <DocHeader kind="Case brief" reference={c.id} operator={operator} by={by} at={at} form={`For the Head of Fraud · written ${formatStamp(brief.generated_at)}`} />

            <div className="flex flex-col gap-3 pt-6 pb-8">
              <div className="flex items-center gap-2">
                <Badge label={`${OUTCOME[brief.outcome]}${brief.outcome_state === "proposed" ? " · proposed" : ""}`} tone={brief.outcome === "confirmed_fraud" ? "critical" : "neutral"} />
                <span className="text-caption text-text-secondary">
                  {c.subject.name} · {c.subject.msisdn}
                </span>
              </div>
              <h1 className="text-display text-text-primary">{c.title}</h1>
              <ol className="grid grid-cols-3 gap-x-4 gap-y-1 border-y border-border-default py-2">
                {brief.chapters.map((ch) => (
                  <li key={ch.number} className="flex gap-2 text-caption">
                    <span className="font-mono text-text-tertiary">{String(ch.number).padStart(2, "0")}</span>
                    <span className="text-text-primary">{ch.short}</span>
                    <span className="ml-auto font-mono text-text-tertiary">{ch.at ? formatClock(ch.at) : "Now"}</span>
                  </li>
                ))}
              </ol>
            </div>

            {brief.chapters.map((ch) => (
              <article key={ch.number} className={cn("flex flex-col gap-4", ch.number > 1 && "mt-12 break-before-page print:mt-0")}>
                <header className="flex items-baseline gap-3 border-b-2 border-text-primary pb-2">
                  <span className="font-mono text-h2 text-text-tertiary">{String(ch.number).padStart(2, "0")}</span>
                  <h2 className="flex-1 text-h2 text-text-primary">{ch.title}</h2>
                  <span className="font-mono text-caption text-text-secondary">{ch.at ? formatClock(ch.at) : "Now"}</span>
                </header>
                <p className="text-body-l text-text-primary">{ch.summary}</p>
                <div className="flex gap-6">
                  {ch.stats.map((s) => (
                    <div key={s.label}>
                      <p className={cn("text-h2 tabular-nums", (s.severity && STAT_TONE[s.severity]) ?? "text-text-primary")}>{s.value}</p>
                      <p className="text-caption text-text-secondary">{s.label}</p>
                    </div>
                  ))}
                </div>
                <ChapterVisual v={ch.visual} />
              </article>
            ))}

            <footer className="mt-8 flex flex-col gap-1 border-t-2 border-text-primary pt-2 text-caption text-text-secondary break-inside-avoid">
              <p>
                Written by FraudDetection from the case record at {formatStamp(brief.generated_at)}. The outcome is {brief.outcome_state === "proposed" ? "proposed and can change at sign-off" : "on the record"}; the case in
                FraudDetection is the reference.
              </p>
              <p>Phone numbers are masked. This copy carries {by}’s name and the export is logged in the audit trail. Don’t forward it outside {operator}.</p>
            </footer>
          </div>
        );
      }}
    </PrintDocument>
  );
}
