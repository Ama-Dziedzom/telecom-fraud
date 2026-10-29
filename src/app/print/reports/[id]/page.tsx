"use client";

import { CaseStatusBadge } from "@/components/app/indicators";
import { DocHeader, Field, PrintDocument, Section, doc, formatStamp } from "@/components/print/PrintDocument";
import { scheduleLabel, templateLabel, type Report } from "@/components/reports/ReportModals";
import { fraudTypeLabel, useApi, type CaseStatus, type Money, type PersonRef } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatMoney, TZ } from "@/lib/time";
import { useParams } from "next/navigation";

type Preview = Report & {
  generated_by: PersonRef;
  generated_at: string;
  expires_at: string;
  rows: number;
  preview: {
    summary: { cases: number; closed: number; open: number; confirmed_fraud: number; lost: Money; false_positive: number; recovered: Money };
    total_rows: number;
    rows: Array<{ case_id: string; fraud_type: string; status: CaseStatus; outcome: string | null; loss: Money; closed_at: string | null }>;
  };
};

const money = (m: Money) => formatMoney(m.amount_minor, m.currency);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
/** 18 Jan 2027, from `2027-01-18`. */
const dayOnly = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

const OUTCOME: Record<string, string> = { confirmed_fraud: "Confirmed fraud", false_positive: "False positive", inconclusive: "Inconclusive" };

/** H12/H14 · Report · PDF — the figures, how the cases ended, then every case. */
export default function ReportPdfPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error } = useApi<Preview>(`/reports/${id}`);

  if (error) return <p className="p-10 text-body-m text-text-secondary">This report isn’t available. It may have expired (reports are kept for 90 days) or been deleted.</p>;

  const file = r ? r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : id;
  return (
    <PrintDocument kind="Report" reference={r?.name ?? id} fileName={file} ready={!!r}>
      {({ by, at, operator }) => {
        if (!r) return null;
        const s = r.preview.summary;
        const rows = r.preview.rows;
        const shownLoss = rows.reduce((n, c) => n + c.loss.amount_minor, 0);
        const inconclusive = Math.max(0, s.closed - s.confirmed_fraud - s.false_positive);
        const split = [
          { label: "Confirmed fraud", n: s.confirmed_fraud, bar: "bg-critical-solid" },
          { label: "False positive", n: s.false_positive, bar: "bg-success-solid" },
          { label: "Inconclusive", n: inconclusive, bar: "bg-text-tertiary" },
          { label: "Still open", n: s.open, bar: "bg-border-default" },
        ].filter((x) => x.n > 0);
        return (
          <div className="flex flex-col gap-6">
            <DocHeader kind="Report" reference={templateLabel(r.template)} operator={operator} by={by} at={at} form={`${scheduleLabel(r.schedule)} · ${r.id}`} />

            <div className="flex flex-col gap-1">
              <h1 className="text-h1 text-text-primary">{r.name}</h1>
              <p className="text-body-m text-text-secondary">
                Made {formatStamp(r.generated_at)} for {r.generated_by.name} · {s.cases} cases
              </p>
            </div>

            <Section letter="A" title="In numbers">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Cases", value: String(s.cases), sub: `${s.closed} closed · ${s.open} open` },
                  { label: "Confirmed fraud", value: String(s.confirmed_fraud), sub: `${money(s.lost)} lost` },
                  { label: "False positive", value: String(s.false_positive), sub: `${pct(s.false_positive, s.closed)}% of closed` },
                  { label: "Recovered", value: money(s.recovered), sub: `${pct(s.recovered.amount_minor, s.lost.amount_minor)}% of the loss` },
                ].map((t) => (
                  <div key={t.label} className="rounded-md border border-border-default px-3 py-2 break-inside-avoid">
                    <p className="text-caption text-text-secondary">{t.label}</p>
                    <p className="text-h3 text-text-primary tabular-nums">{t.value}</p>
                    <p className="text-caption text-text-secondary">{t.sub}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 pt-1 break-inside-avoid">
                <p className="text-label-s text-text-primary">How the {s.cases} cases stand</p>
                <div className="flex h-3 overflow-hidden rounded-sm">
                  {split.map((x) => (
                    <span key={x.label} className={x.bar} style={{ width: `${(x.n / s.cases) * 100}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 text-caption text-text-secondary">
                  {split.map((x) => (
                    <span key={x.label} className="flex items-center gap-1.5">
                      <span className={cn("size-2 rounded-[2px]", x.bar)} />
                      {x.label} {x.n}
                    </span>
                  ))}
                </div>
              </div>
            </Section>

            <Section letter="B" title="Cases" aside={rows.length < r.preview.total_rows ? `Showing ${rows.length} of ${r.preview.total_rows}` : `${rows.length} cases`}>
              <table className={doc.table}>
                <thead>
                  <tr>
                    <th className={doc.th}>Case</th>
                    <th className={doc.th}>Type</th>
                    <th className={doc.th}>Status</th>
                    <th className={doc.th}>Outcome</th>
                    <th className={doc.th}>Closed</th>
                    <th className={cn(doc.th, doc.num)}>Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.case_id} className={doc.tr}>
                      <td className={cn(doc.td, doc.mono)}>{c.case_id}</td>
                      <td className={doc.td}>{fraudTypeLabel(c.fraud_type)}</td>
                      <td className={doc.td}>
                        <CaseStatusBadge status={c.status} />
                      </td>
                      <td className={cn(doc.td, c.outcome === "confirmed_fraud" && "text-critical-fg")}>{c.outcome ? `${OUTCOME[c.outcome] ?? c.outcome}${c.closed_at ? "" : " (proposed)"}` : "—"}</td>
                      <td className={cn(doc.td, "text-text-secondary")}>{c.closed_at ? formatStamp(c.closed_at) : "Open"}</td>
                      <td className={cn(doc.td, doc.num, "font-medium")}>{c.loss.amount_minor ? money(c.loss) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="break-inside-avoid">
                    <td colSpan={5} className={cn(doc.td, "pt-2 text-text-secondary")}>
                      Loss across these {rows.length} cases
                    </td>
                    <td className={cn(doc.td, doc.num, "pt-2 text-label-s")}>{money({ amount_minor: shownLoss, currency: s.lost.currency })}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section letter="C" title="About this report" className="break-inside-avoid">
              <dl className="grid grid-cols-2 gap-x-6">
                <div>
                  <Field label="Template">{templateLabel(r.template)}</Field>
                  <Field label="Runs" sub={r.next_run_at ? `Next ${formatStamp(r.next_run_at)}` : undefined}>
                    {scheduleLabel(r.schedule)}
                    {r.schedule?.paused ? " · paused" : ""}
                  </Field>
                  <Field label="Kept until">{dayOnly(r.expires_at)}</Field>
                </div>
                <div>
                  <Field label="Owner">{r.owner.name}</Field>
                  <Field label="Shared with">{r.shared_with.length ? r.shared_with.map((p) => p.name).join(", ") : "No one else"}</Field>
                </div>
              </dl>
            </Section>

            <footer className="flex flex-col gap-1 border-t-2 border-text-primary pt-2 text-caption text-text-secondary break-inside-avoid">
              <p>Made by FraudDetection from the case records at {formatStamp(r.generated_at)}. Losses are in cedis; a proposed outcome can still change at sign-off.</p>
              <p>Phone numbers and IDs are masked. This copy carries {by}’s name and the download is logged in the audit trail. Don’t forward it outside {operator}.</p>
            </footer>
          </div>
        );
      }}
    </PrintDocument>
  );
}
