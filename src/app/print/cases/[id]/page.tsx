"use client";

import { DocHeader, Field, PrintDocument, Section, doc, formatStamp } from "@/components/print/PrintDocument";
import { Badge } from "@/components/ui/Badge";
import { NEXT_STEP_LABELS, STAGES, useCase, useCaseTransactions, useEvidence, useLinkedAlerts, useTimeline, type CaseDetail, type Outcome } from "@/lib/api/cases";
import { fraudTypeLabel, type Money } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock, formatMoney } from "@/lib/time";
import { useParams } from "next/navigation";

const money = (m: Money, decimals = false) => formatMoney(m.amount_minor, m.currency, { decimals });

const SEVERITY = { critical: "critical", high: "high", medium: "medium", low: "neutral" } as const;

const STATUS: Record<CaseDetail["status"], string> = {
  new: "New",
  investigating: "Investigating",
  escalated: "Escalated",
  sent_back: "Sent back",
  pending_decision: "Waiting for a decision",
  closed: "Closed",
  reopened: "Reopened",
};

const MONEY: Record<CaseDetail["glance"]["money"]["label"], string> = {
  money_at_stake: "Money at stake",
  money_out: "Money out",
  being_recovered: "Being recovered",
  recovered: "Recovered",
  lost: "Lost",
};

const OUTCOME: Record<Outcome, { label: string; tone: "critical" | "success" | "neutral" }> = {
  confirmed_fraud: { label: "Confirmed fraud", tone: "critical" },
  false_positive: { label: "False positive", tone: "success" },
  inconclusive: { label: "Inconclusive", tone: "neutral" },
};

const TX_TYPE: Record<string, string> = {
  agent_cash_out: "Agent cash-out",
  transfer: "Transfer",
  airtime: "Airtime",
  merchant: "Merchant",
  transfer_in: "Transfer in",
};

const WHERE_NOW: Record<string, string> = {
  in_wallet: "Still in the wallet",
  cashed_out: "Cashed out",
  agent_holds: "Agent holds it",
};

const SOURCE: Record<string, string> = { person: "", system: "FraudDetection", momo: "MoMo", network: "Network", crm: "CRM" };

const EVIDENCE_KIND: Record<string, string> = { call_log: "Call log", transactions: "Transactions", file: "File", auto: "Automatic", note: "Note" };

/** 20 Oct / 06:34, stacked in a narrow column. */
const dayTime = (iso: string) => (
  <>
    {formatStamp(iso).split(" 20")[0]}
    <br />
    {formatClock(iso)}
  </>
);

const size = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`);

/** E12 · Case report · PDF — summary, what happened, outcome, then the record: timeline, money, evidence, alerts. */
export default function CaseReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error } = useCase(id);
  const { data: timeline } = useTimeline(id);
  const { data: txs } = useCaseTransactions(id);
  const { data: evidence } = useEvidence(id);
  const { data: alerts } = useLinkedAlerts(id);
  const ready = !!c && !!timeline && !!txs && !!evidence && !!alerts;

  if (error) return <p className="p-10 text-body-m text-text-secondary">We couldn’t load {id} for export. Go back to the case and try again.</p>;

  return (
    <PrintDocument kind="Case report" reference={id} fileName={`${id}-case-report`} ready={ready}>
      {({ by, at, operator }) => {
        if (!c || !timeline || !txs || !evidence || !alerts) return null;
        const r = c.resolution;
        const stage = STAGES.find((s) => s.id === c.stage)?.label ?? c.stage;
        const outflow = txs.data.filter((t) => t.direction === "out");
        return (
          <div className="flex flex-col gap-6">
            <DocHeader kind="Case report" reference={c.id} operator={operator} by={by} at={at} form={`Opened ${formatStamp(c.opened.at)}${c.opened.from_alert ? ` from ${c.opened.from_alert}` : ""}`} />

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={c.severity[0].toUpperCase() + c.severity.slice(1)} tone={SEVERITY[c.severity]} />
                <Badge label={r ? OUTCOME[r.outcome].label : STATUS[c.status]} tone={r ? OUTCOME[r.outcome].tone : "info"} />
                <span className="text-caption text-text-secondary">Stage: {stage}</span>
              </div>
              <h1 className="text-h1 text-text-primary">{c.title}</h1>
              <p className="text-body-m text-text-secondary">
                {c.subject.name} · {c.subject.msisdn} · {money(c.glance.money.amount)} {MONEY[c.glance.money.label].toLowerCase()}
              </p>
            </div>

            <Section letter="A" title="Summary">
              <dl className="grid grid-cols-2 gap-x-6">
                <div>
                  <Field label="Subscriber" sub={c.contact && [c.contact.alt_msisdn && `Also on ${c.contact.alt_msisdn}`, c.contact.language && `speaks ${c.contact.language}`].filter(Boolean).join(" · ")}>
                    {c.subject.name} · {c.subject.msisdn}
                  </Field>
                  <Field label="Fraud type">{fraudTypeLabel(c.glance.fraud_type)}</Field>
                  <Field label="Risk score" sub={`${c.glance.rules_fired} rules fired`}>
                    {c.glance.risk_score} of 100
                  </Field>
                  <Field label={MONEY[c.glance.money.label]} sub={c.glance.money.note}>
                    {money(c.glance.money.amount)}
                  </Field>
                </div>
                <div>
                  <Field label="Assigned to">{c.assignee?.name ?? "No one yet"}</Field>
                  <Field label="First response" sub={`Target ${c.glance.first_response.sla_minutes} min`}>
                    {c.glance.first_response.minutes ? `${c.glance.first_response.minutes} min · ${c.glance.first_response.met ? "on time" : "late"}` : "Not started"}
                  </Field>
                  {c.sla && <Field label="Close by">{formatStamp(c.sla.close_due_at)}{c.sla.breached ? " · overdue" : ""}</Field>}
                  <Field label="Linked cases">{c.linked_cases.length ? c.linked_cases.join(", ") : "None"}</Field>
                </div>
              </dl>
              {c.banners
                .filter((b) => b.kind === "protected")
                .map((b) => (
                  <p key={b.kind} className="rounded-md border border-success-border bg-success-bg px-3 py-2 text-caption text-success-fg break-inside-avoid">
                    <span className="font-medium">{b.title}{b.at ? ` at ${formatClock(b.at)}` : ""}.</span> {b.detail}
                  </p>
                ))}
            </Section>

            <Section letter="B" title="What happened" aside={`${c.what_happened.length} steps`}>
              <ol className="flex flex-col">
                {c.what_happened.map((s, i) => (
                  <li key={i} className="grid grid-cols-[18mm_12px_1fr_auto] gap-x-2 break-inside-avoid">
                    <span className="pt-px font-mono text-[11px] leading-4 text-text-secondary">{formatClock(s.at)}</span>
                    <span className="flex flex-col items-center">
                      <span className={cn("mt-1 size-2 shrink-0 rounded-full", s.amount ? "bg-critical-solid" : "bg-text-primary")} />
                      {i < c.what_happened.length - 1 && <span className="w-px flex-1 bg-border-default" />}
                    </span>
                    <div className="pb-3">
                      <p className="text-label-s text-text-primary">{s.label}</p>
                      {s.detail && <p className="text-caption text-text-secondary">{s.detail}</p>}
                      {s.links?.length ? <p className="text-caption text-text-secondary">See {s.links.join(", ")}</p> : null}
                    </div>
                    <span className="text-label-s text-critical-fg tabular-nums">{s.amount ? money(s.amount) : ""}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section letter="C" title="Outcome" className="break-inside-avoid">
              {r ? (
                <>
                  <p className="text-body-s text-text-primary">{r.summary}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Lost", r.lost],
                      ["Recovered", r.recovered],
                      ["Net loss", r.net_loss],
                    ].map(([label, m]) => (
                      <div key={label as string} className="rounded-md border border-border-default px-3 py-2">
                        <p className="text-caption text-text-secondary">{label as string}</p>
                        <p className="text-title text-text-primary tabular-nums">{money(m as Money)}</p>
                      </div>
                    ))}
                  </div>
                  <dl>
                    <Field label="Outcome">{OUTCOME[r.outcome].label}</Field>
                    <Field label="Signed off by">{r.signed_off_by?.name ?? "—"}</Field>
                    {r.co_signed_by && <Field label="Co-signed by" sub="Head of Fraud, for losses over GHS 20,000">{r.co_signed_by.name}</Field>}
                    <Field label="Closed">{formatStamp(r.closed_at)}</Field>
                    <Field label="Regulator reference">{r.regulator_reference ?? "Not reported"}</Field>
                  </dl>
                </>
              ) : (
                <dl>
                  <Field label="Outcome">Not decided yet · {STATUS[c.status].toLowerCase()}</Field>
                  <Field label="Done">{c.next_steps.done.length ? c.next_steps.done.map((k) => NEXT_STEP_LABELS[k]).join(", ") : "Nothing yet"}</Field>
                  {c.next_steps.recommended && c.next_steps.recommended.kind !== "none" && (
                    <Field label="Next" sub={c.next_steps.recommended.detail}>
                      {c.next_steps.recommended.title}
                    </Field>
                  )}
                  {c.next_steps.remaining.length > 0 && <Field label="Still to do">{c.next_steps.remaining.map((k) => NEXT_STEP_LABELS[k]).join(", ")}</Field>}
                </dl>
              )}
            </Section>

            <Section letter="D" title="Timeline" aside={`${timeline.data.length} events`}>
              <table className={doc.table}>
                <thead>
                  <tr>
                    <th className={cn(doc.th, "w-[18mm]")}>Time</th>
                    <th className={doc.th}>Event</th>
                    <th className={cn(doc.th, "w-[32mm]")}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {[...timeline.data].reverse().map((e) => (
                    <tr key={e.id} className={doc.tr}>
                      <td className={cn(doc.td, doc.mono, "text-text-secondary")}>{dayTime(e.at)}</td>
                      <td className={doc.td}>
                        <p className="font-medium text-text-primary">{e.title}</p>
                        {e.detail && <p className="text-text-secondary">{e.detail}</p>}
                      </td>
                      <td className={cn(doc.td, "text-text-secondary")}>{e.actor?.name ?? SOURCE[e.source]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section letter="E" title="Money movements" aside={`${outflow.length} out · ${txs.totals.flagged} flagged`}>
              <table className={doc.table}>
                <thead>
                  <tr>
                    <th className={cn(doc.th, "w-[18mm]")}>Time</th>
                    <th className={doc.th}>Reference</th>
                    <th className={doc.th}>Type</th>
                    <th className={doc.th}>To</th>
                    <th className={doc.th}>Now</th>
                    <th className={cn(doc.th, doc.num)}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.data.map((t) => (
                    <tr key={t.id} className={doc.tr}>
                      <td className={cn(doc.td, doc.mono, "text-text-secondary")}>{dayTime(t.at)}</td>
                      <td className={cn(doc.td, doc.mono)}>
                        {t.id}
                        {t.flagged && <span className="ml-1 font-sans text-critical-fg">●</span>}
                      </td>
                      <td className={doc.td}>{TX_TYPE[t.type] ?? t.type}</td>
                      <td className={doc.td}>
                        {t.counterparty}
                        {(t.counterparty_case_id || t.counterparty_new) && (
                          <span className="block text-text-secondary">{t.counterparty_case_id ? `In ${t.counterparty_case_id}` : "New recipient"}</span>
                        )}
                      </td>
                      <td className={cn(doc.td, "text-text-secondary")}>{t.where_now ? WHERE_NOW[t.where_now] : ""}</td>
                      <td className={cn(doc.td, doc.num, "font-medium", t.direction === "in" && "text-success-fg")}>
                        {t.direction === "in" ? "+" : "−"}
                        {money(t.amount, true)}
                      </td>
                    </tr>
                  ))}
                  <tr className="break-inside-avoid">
                    <td colSpan={5} className={cn(doc.td, "pt-2 text-text-secondary")}>
                      {txs.totals.out_since_swap ? "Out since the SIM swap" : "Total out"}
                      {txs.totals.window_minutes ? `, in ${txs.totals.window_minutes} min` : ""} · balance now {money(txs.totals.balance, true)}
                    </td>
                    <td className={cn(doc.td, doc.num, "pt-2 text-label-s")}>
                      {money(txs.totals.out_since_swap ?? txs.totals.out ?? { amount_minor: outflow.reduce((n, t) => n + t.amount.amount_minor, 0), currency: "GHS" }, true)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-caption text-text-tertiary">
                <span className="text-critical-fg">●</span> flagged by the fraud rules
              </p>
            </Section>

            <Section letter="F" title="Evidence" aside={`${evidence.data.length} items · kept 7 years`}>
              <table className={doc.table}>
                <thead>
                  <tr>
                    <th className={doc.th}>Item</th>
                    <th className={doc.th}>Attached</th>
                    <th className={doc.th}>SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.data.map((e) => (
                    <tr key={e.id} className={doc.tr}>
                      <td className={doc.td}>
                        <p className="font-medium text-text-primary">{e.title}</p>
                        <p className="text-text-secondary">
                          {EVIDENCE_KIND[e.kind]} · {e.item_count ? `${e.item_count} items` : `${e.pages} ${e.pages === 1 ? "page" : "pages"}`} · {size(e.size_bytes)}
                        </p>
                      </td>
                      <td className={cn(doc.td, "w-[34mm] text-text-secondary")}>
                        {e.attached_by?.name ?? "FraudDetection"}
                        <span className="block">{formatStamp(e.attached_at)}</span>
                      </td>
                      <td className={cn(doc.td, doc.mono, "w-[44mm] break-all text-text-secondary")}>{e.sha256}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section letter="G" title="Linked alerts" aside={`${alerts.data.length} alerts`}>
              <table className={doc.table}>
                <thead>
                  <tr>
                    <th className={doc.th}>Alert</th>
                    <th className={doc.th}>Raised</th>
                    <th className={doc.th}>What</th>
                    <th className={cn(doc.th, doc.num)}>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.data.map((a) => (
                    <tr key={a.id} className={doc.tr}>
                      <td className={cn(doc.td, doc.mono)}>{a.id}</td>
                      <td className={cn(doc.td, "text-text-secondary")}>{formatStamp(a.created_at)}</td>
                      <td className={doc.td}>
                        {a.title}
                        <span className="block text-text-secondary">
                          {a.link.kind === "opened" ? "Opened the case" : a.link.kind === "auto" ? "Linked automatically" : `Linked by ${a.link.by?.name ?? "someone"}`} · rules {a.rule_ids.join(", ")}
                        </span>
                      </td>
                      <td className={cn(doc.td, doc.num, "font-medium")}>{a.risk_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <footer className="flex flex-col gap-1 border-t-2 border-text-primary pt-2 text-caption text-text-secondary break-inside-avoid">
              <p>
                Made by FraudDetection from the case record at {formatClock(at)} on {formatStamp(at).split(",")[0]}. It shows the case as it stood then; the record in FraudDetection is the
                reference.
              </p>
              <p>Phone numbers and IDs are masked. This copy carries {by}’s name and the export is logged in the audit trail. Don’t forward it outside {operator}.</p>
            </footer>
          </div>
        );
      }}
    </PrintDocument>
  );
}
